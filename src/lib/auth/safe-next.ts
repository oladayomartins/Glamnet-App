/**
 * Where to send someone after they sign in.
 *
 * `next` arrives in the query string, so anyone can write it. Only same-site
 * paths are honoured: "//evil.example" and "/\\evil.example" are
 * protocol-relative URLs that a browser treats as another host, and would
 * turn the sign-in page into a trusted-looking redirect to a phishing site.
 */
export function safeNext(next: string | null | undefined, fallback = "/account"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
