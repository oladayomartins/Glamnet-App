/**
 * Natural language in, catalogue out.
 *
 * A customer types what they want in their own words — "make my hair", "box
 * braids", "something for my birthday". A booking, on the other hand, is made
 * against a service id with a price and a duration attached to it. This module
 * is the join between the two, and it is deliberately the ONLY join: nothing
 * downstream ever sees the customer's phrasing, so "can you make me look like
 * Beyoncé" cannot become a service, only a search that finds one or finds
 * nothing.
 *
 * It is pure and knows nothing about the database. Callers pass the catalogue
 * they already read — which is how the API can filter to services with a
 * vendor behind them before matching ever runs, and how this can be tested
 * without one.
 */

/** The shape any caller must supply. Whatever else a service row has is ignored. */
export interface CatalogueEntry {
  id: string;
  name: string;
  category: string;
}

export interface ServiceMatch<T extends CatalogueEntry = CatalogueEntry> {
  service: T;
  /** Higher is a better answer to the query. */
  score: number;
  /**
   * Why this was offered, in the customer's terms. Shown under the heading
   * "What did you mean?", so it has to read as an explanation rather than a
   * debug string.
   */
  reason: "name" | "phrase" | "category";
}

/**
 * Words that carry no intent.
 *
 * Stripping them is what lets "can you make my hair" and "hair" reach the same
 * place. They are removed only when other words survive: a customer who types
 * nothing but "please" gets no matches rather than the whole catalogue.
 */
const FILLER = new Set([
  "a", "an", "and", "any", "are", "book", "booking", "can", "could", "do",
  "does", "doing", "for", "get", "getting", "have", "i", "id", "in", "is",
  "like", "looking", "me", "my", "need", "needs", "of", "on", "or", "please",
  "some", "someone", "something", "the", "to", "want", "wants", "with",
  "would", "you", "your",
]);

/**
 * Phrases a customer uses for work the catalogue names differently.
 *
 * This is a vocabulary, not a rule engine: each entry says "when these words
 * appear, these catalogue words are what was meant". It is intentionally
 * small and hand-written. An alias that guesses wrong sends someone to the
 * wrong service, so the bar for adding one is that the mapping is obvious to
 * anyone who books the service — "gel" means a manicure, "plaits" means
 * braids — never that it might loosely relate.
 *
 * Every target here must be a word that actually appears in service names or
 * categories; `unmatchedAliasTargets` exists so a drifting catalogue fails a
 * test rather than quietly failing a customer.
 */
const ALIASES: { phrase: string[]; means: string[] }[] = [
  // Hair, in the words people actually use.
  { phrase: ["hair"], means: ["hair"] },
  { phrase: ["hairdo"], means: ["hair"] },
  { phrase: ["do", "hair"], means: ["hair"] },
  { phrase: ["style", "hair"], means: ["hair"] },
  { phrase: ["blowdry"], means: ["blow", "dry"] },
  { phrase: ["blow", "dry"], means: ["blow", "dry"] },
  { phrase: ["plaits"], means: ["braids"] },
  { phrase: ["plait"], means: ["braids"] },
  { phrase: ["cornrows"], means: ["braids"] },
  { phrase: ["knotless"], means: ["braids"] },
  { phrase: ["boho"], means: ["braids"] },
  { phrase: ["box", "braids"], means: ["braids"] },
  { phrase: ["updo"], means: ["updo"] },
  { phrase: ["up", "do"], means: ["updo"] },
  { phrase: ["wig"], means: ["wig"] },
  { phrase: ["weave"], means: ["wig"] },
  { phrase: ["installation"], means: ["wig"] },

  // Makeup.
  { phrase: ["makeup"], means: ["makeup"] },
  { phrase: ["make", "up"], means: ["makeup"] },
  { phrase: ["mua"], means: ["makeup"] },
  { phrase: ["face", "beat"], means: ["makeup"] },
  { phrase: ["beat"], means: ["makeup"] },
  { phrase: ["glam"], means: ["glam"] },
  { phrase: ["lashes"], means: ["lashes"] },
  { phrase: ["eyelashes"], means: ["lashes"] },
  { phrase: ["brows"], means: ["brow"] },
  { phrase: ["eyebrows"], means: ["brow"] },

  // Nails.
  { phrase: ["nails"], means: ["nails", "manicure"] },
  { phrase: ["nail"], means: ["nails", "manicure"] },
  { phrase: ["gel"], means: ["gel", "manicure"] },
  { phrase: ["mani"], means: ["manicure"] },
  { phrase: ["biab"], means: ["biab", "manicure"] },

  // Occasions. These say which catalogue words are meant, never which service:
  // "wedding" narrows to bridal work, it does not pick one.
  { phrase: ["wedding"], means: ["bridal"] },
  { phrase: ["bride"], means: ["bridal"] },
  { phrase: ["prom"], means: ["prom"] },
  { phrase: ["birthday"], means: ["glam"] },
  { phrase: ["party"], means: ["glam"] },
  { phrase: ["event"], means: ["event", "glam"] },
];

/** Split into comparable words. Punctuation and case carry no meaning here. */
export function tokenise(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** Drop filler, but never everything — a query of pure filler stays as it was. */
function meaningful(tokens: string[]): string[] {
  const kept = tokens.filter((token) => !FILLER.has(token));
  return kept.length > 0 ? kept : tokens;
}

/**
 * The catalogue words a query implies, beyond the ones it already contains.
 *
 * Multi-word aliases are matched as adjacent pairs so "make up" reads as
 * makeup while "make my hair" does not — the words have to actually sit
 * together for the phrase to have been used.
 */
function impliedWords(tokens: string[]): Set<string> {
  const implied = new Set<string>();
  const pairs = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i += 1) {
    pairs.add(`${tokens[i]} ${tokens[i + 1]}`);
  }

  for (const alias of ALIASES) {
    const hit =
      alias.phrase.length === 1
        ? tokens.includes(alias.phrase[0])
        : pairs.has(alias.phrase.join(" "));
    if (hit) for (const word of alias.means) implied.add(word);
  }

  return implied;
}

/**
 * Rank the catalogue against what the customer typed.
 *
 * Scoring, strongest first:
 *   - every query word that appears in the service name
 *   - every word the query implies through the alias vocabulary
 *   - the service's category matching a query or implied word
 *
 * A service scoring zero is not returned at all. Offering the catalogue to
 * someone whose words matched nothing is how a customer ends up booking the
 * wrong thing, and "no match" is a result the caller can act on — it is what
 * puts "browse services" in front of them instead.
 */
export function matchServices<T extends CatalogueEntry>(
  query: string,
  catalogue: T[],
  limit = 5,
): ServiceMatch<T>[] {
  const tokens = meaningful(tokenise(query));
  if (tokens.length === 0) return [];

  const implied = impliedWords(tokens);

  const matches: ServiceMatch<T>[] = [];

  for (const service of catalogue) {
    const nameWords = new Set(tokenise(service.name));
    const categoryWords = new Set(tokenise(service.category));

    let score = 0;
    let reason: ServiceMatch["reason"] = "category";

    for (const token of tokens) {
      if (nameWords.has(token)) {
        score += 10;
        reason = "name";
      }
    }

    for (const word of implied) {
      if (nameWords.has(word)) {
        score += 6;
        if (reason !== "name") reason = "phrase";
      }
    }

    // The category is worth less than the name on purpose: "braids" should
    // rank Knotless Box Braids above every other Hair service, not merely
    // somewhere among them.
    for (const word of [...tokens, ...implied]) {
      if (categoryWords.has(word)) {
        score += 3;
        break;
      }
    }

    if (score > 0) matches.push({ service, score, reason });
  }

  return matches
    .sort(
      (a, b) =>
        b.score - a.score || a.service.name.localeCompare(b.service.name),
    )
    .slice(0, limit);
}

/**
 * Alias targets that no service in the catalogue can satisfy.
 *
 * An alias pointing at a word the catalogue no longer uses is silent damage:
 * the customer types a word the platform advertises understanding and gets
 * nothing back. A test walks this so the catalogue and the vocabulary have to
 * drift apart deliberately rather than by neglect.
 */
export function unmatchedAliasTargets(catalogue: CatalogueEntry[]): string[] {
  const known = new Set<string>();
  for (const service of catalogue) {
    for (const word of tokenise(service.name)) known.add(word);
    for (const word of tokenise(service.category)) known.add(word);
  }

  const missing = new Set<string>();
  for (const alias of ALIASES) {
    for (const word of alias.means) {
      if (!known.has(word)) missing.add(word);
    }
  }

  return [...missing].sort();
}
