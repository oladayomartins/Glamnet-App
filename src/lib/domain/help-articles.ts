import { FREE_CANCELLATION_HOURS } from "./cancellation";
import { DISPUTE_WINDOW_HOURS, REQUIRED_COMPLETION_PHOTOS } from "./completion";

/**
 * The support knowledge base: short answers to the questions people actually
 * ask, written from how the app really works. Policy numbers come from the
 * same constants the code enforces, so an article can't promise a window
 * the app doesn't keep.
 *
 * Plain data, no JSX, so the help centre can search it and the contact form
 * can suggest articles for the topic someone picks.
 */

export type HelpTopic = "booking" | "payments" | "vendors" | "account";

export const HELP_TOPICS: { key: HelpTopic; title: string; blurb: string }[] = [
  { key: "booking", title: "Booking & appointments", blurb: "Finding a vendor, booking, changing and cancelling." },
  { key: "payments", title: "Payments, PINs & refunds", blurb: "Card holds, your checkout PIN, refunds and problems." },
  { key: "vendors", title: "For vendors", blurb: "Going live, getting verified, payouts and your storefront." },
  { key: "account", title: "Account & privacy", blurb: "Signing in, notifications, your details and your data." },
];

export type HelpBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "link"; href: string; label: string };

export interface HelpArticle {
  slug: string;
  topic: HelpTopic;
  title: string;
  /** One line, shown in lists and search results. */
  summary: string;
  body: HelpBlock[];
  /** Extra words people search with that the text may not use. */
  keywords?: string[];
}

const p = (text: string): HelpBlock => ({ kind: "p", text });
const list = (...items: string[]): HelpBlock => ({ kind: "list", items });
const link = (href: string, label: string): HelpBlock => ({ kind: "link", href, label });

export const HELP_ARTICLES: HelpArticle[] = [
  // --- Booking -------------------------------------------------------------
  {
    slug: "how-booking-works",
    topic: "booking",
    title: "How booking works",
    summary: "Find a vendor, pick a time, and your card is only held until you're happy.",
    keywords: ["book", "appointment", "how"],
    body: [
      p("Search by service and postcode, or browse vendors near you. Every vendor shows their work, their menu and real prices."),
      list(
        "Pick a service and a time the vendor actually has free.",
        "Confirm the full price — everything is itemised before you book.",
        "Your card is held, not charged.",
        "At the end of the appointment you give your vendor a 4-digit PIN, and only then are they paid.",
      ),
      link("/how-it-works", "See how GLAMNET works"),
    ],
  },
  {
    slug: "verified-vendors",
    topic: "booking",
    title: "What does “Verified” mean?",
    summary: "Verified vendors have finished every step and been checked by us.",
    keywords: ["not verified", "badge", "checked", "safe", "trust"],
    body: [
      p("A gold seal means the vendor has completed every setup step — including ID, insurance, a licence or a certificate, and a linked bank — and our team has checked and approved them."),
      p("Vendors marked “Not verified” are new to GLAMNET and still finishing those checks. You can still book them, and your card is still only held until you give them your PIN."),
      p("Short-notice requests only ever go to verified vendors."),
    ],
  },
  {
    slug: "short-notice-bookings",
    topic: "booking",
    title: "Short-notice bookings",
    summary: "Need someone soon? Book anyway — any short-notice rate is shown before you pay.",
    keywords: ["emergency", "urgent", "today", "tonight", "last minute"],
    body: [
      p("If you book close to the appointment time, the price may include a short-notice rate. It's always shown in the price before you confirm, never added afterwards."),
      p("Short-notice requests go to verified vendors nearby, and the first one to accept takes the booking."),
    ],
  },
  {
    slug: "cancel-a-booking",
    topic: "booking",
    title: "Cancelling a booking",
    summary: `Free more than ${FREE_CANCELLATION_HOURS} hours before; a fee may apply after that.`,
    keywords: ["cancel", "cancellation", "fee", "change my mind"],
    body: [
      p("Cancel from your booking page at any time. What it costs depends on when:"),
      list(
        "Before a vendor accepts — free.",
        `More than ${FREE_CANCELLATION_HOURS} hours before your appointment — free.`,
        `Less than ${FREE_CANCELLATION_HOURS} hours before — a cancellation fee may apply, shown before you confirm.`,
        "Once your vendor is on their way — this counts as a missed appointment.",
      ),
      p("We remind you the day before your free cancellation ends, and your booking page always shows the exact deadline."),
      link("/cancellations", "Read the full cancellation policy"),
    ],
  },
  {
    slug: "vendor-cancelled",
    topic: "booking",
    title: "My vendor cancelled",
    summary: "You pay nothing, and you're free to book someone else straight away.",
    keywords: ["vendor cancelled", "no show", "didn't come", "didn't turn up"],
    body: [
      p("If your vendor cancels, the hold on your card is released in full and you pay nothing. Vendors must give a reason, which you'll see on your booking."),
      p("If your vendor didn't turn up and didn't cancel, contact us from the booking page or the contact form and we'll sort it out."),
      link("/support/contact", "Contact support"),
    ],
  },
  {
    slug: "address-privacy",
    topic: "booking",
    title: "Who sees my address?",
    summary: "Your vendor only sees your full address once they're confirmed.",
    keywords: ["address", "home visit", "privacy", "location"],
    body: [
      p("For home visits, your vendor only sees your full address once your booking is confirmed. Vendors' own workspace addresses are only shown to clients with a paid booking there."),
      p("On maps and listings, vendors are only ever shown at their postcode area, never their exact address."),
    ],
  },

  // --- Payments ------------------------------------------------------------
  {
    slug: "card-holds",
    topic: "payments",
    title: "When am I charged?",
    summary: "Your card is held when you book and charged only when you give your PIN.",
    keywords: ["charge", "hold", "pending", "authorisation", "payment"],
    body: [
      p("When you book, we place a hold on your card for the full price. It may show as “pending” with your bank — no money has left your account yet."),
      p("For bookings more than a few days away, we save your card and place the hold closer to the date."),
      p("You're charged only when you give your vendor your 4-digit PIN at the end of the appointment."),
    ],
  },
  {
    slug: "checkout-pin",
    topic: "payments",
    title: "Your checkout PIN",
    summary: "Give your vendor the 4-digit PIN when you're happy — that releases their payment.",
    keywords: ["pin", "code", "4 digit", "release payment"],
    body: [
      p(`When your appointment is finished, your vendor uploads ${REQUIRED_COMPLETION_PHOTOS} photos of the work and a 4-digit PIN appears on your booking page.`),
      p("Only give the PIN when you're happy. Giving it confirms the work was done and releases the payment."),
      p("Not happy? Keep the PIN and contact us — the money stays on hold while we look into it."),
    ],
  },
  {
    slug: "raise-a-problem",
    topic: "payments",
    title: "Raising a problem with a service",
    summary: `You have ${DISPUTE_WINDOW_HOURS} hours after paying to raise a problem.`,
    keywords: ["dispute", "complaint", "refund", "unhappy", "bad", "quality"],
    body: [
      p(`If something wasn't right, raise it from your booking page within ${DISPUTE_WINDOW_HOURS} hours of giving your PIN. If you haven't given the PIN yet, keep it and raise the problem instead.`),
      p("We review the booking, the photos your vendor took of the finished work, and what you both tell us, then decide on any refund."),
      link("/support/contact", "Contact support about a booking"),
    ],
  },
  {
    slug: "refunds",
    topic: "payments",
    title: "How long do refunds take?",
    summary: "Released holds disappear in a few days; refunds take 5–10 working days.",
    keywords: ["refund", "money back", "when"],
    body: [
      p("A released card hold usually disappears from your statement within a few days, depending on your bank."),
      p("A refund on a payment that was already taken normally reaches your account in 5–10 working days."),
    ],
  },

  // --- Vendors -------------------------------------------------------------
  {
    slug: "going-live",
    topic: "vendors",
    title: "Going live on GLAMNET",
    summary: "You're listed as soon as your menu, link, area and hours are in.",
    keywords: ["listed", "list my business", "storefront", "sign up", "join"],
    body: [
      p("You go live automatically — no button to press — as soon as these are done:"),
      list("Your name or business name", "At least one service on your menu", "Your storefront link", "Where you work", "Your working hours"),
      p("Until you're verified you're shown as “Not verified”. Clients can book you straight away."),
      link("/provider/onboarding", "Set up your storefront"),
    ],
  },
  {
    slug: "getting-verified",
    topic: "vendors",
    title: "Getting verified",
    summary: "Finish every step, including ID or insurance and your bank, and we'll check you.",
    keywords: ["verify", "verification", "badge", "documents", "kyc", "approve"],
    body: [
      p("Your setup percentage shows how far you are. To reach 100% you need, as well as the basics:"),
      list("A profile photo", "A short bio", "At least one lookbook photo", "ID, insurance, a licence or a certificate", "A bank linked for payouts"),
      p("Once everything is done, our team checks your details and approves you. You then get the verified badge, short-notice requests, and your payouts."),
      link("/provider/onboarding?step=review", "See your checklist"),
    ],
  },
  {
    slug: "held-earnings",
    topic: "vendors",
    title: "Why are my earnings held?",
    summary: "Until you're verified, we keep your earnings safe and pay them when you are.",
    keywords: ["held", "payout", "not paid", "where is my money", "earnings"],
    body: [
      p("While you're not verified, your clients are charged as normal when they give you their PIN, but your share is kept safe by GLAMNET."),
      p("The moment you're verified with a working bank, everything held is sent to your bank automatically. Your dashboard shows how much is waiting for you."),
    ],
  },
  {
    slug: "link-your-bank",
    topic: "vendors",
    title: "Linking your bank",
    summary: "Payouts go through Stripe — GLAMNET never sees your bank details.",
    keywords: ["bank", "stripe", "payout", "account details"],
    body: [
      p("Link your bank from the Payouts step of your storefront setup. Stripe asks for a few details to confirm who you are, then your payouts go straight to your bank."),
      p("If Stripe asks for more information later, your dashboard will tell you."),
      link("/provider/onboarding?step=payouts", "Link your bank"),
    ],
  },
  {
    slug: "storefront-link",
    topic: "vendors",
    title: "Your storefront link and fees",
    summary: "Share your link anywhere — clients from it cost you less.",
    keywords: ["link", "commission", "fees", "bio", "instagram"],
    body: [
      p("Your storefront is your own page at glamnetapp.com/pro/your-name, with your lookbook, menu, calendar and reviews. Share it in your Instagram or TikTok bio."),
      p("Clients who book through your own link cost you a lower commission than clients who find you on the marketplace. The exact rates are shown in your storefront setup."),
    ],
  },
  {
    slug: "hours-and-calendar",
    topic: "vendors",
    title: "Working hours and time off",
    summary: "Clients can only book inside your hours. Block time off from your calendar.",
    keywords: ["hours", "calendar", "availability", "holiday", "time off", "pause"],
    body: [
      p("Set your working week in your storefront setup or your dashboard. Clients only see times inside those hours that aren't already booked."),
      p("Block days or hours off from your calendar, or pause new bookings entirely from your dashboard while you're away."),
    ],
  },

  // --- Account -------------------------------------------------------------
  {
    slug: "cant-sign-in",
    topic: "account",
    title: "I can't sign in",
    summary: "Check you're using the right email, or reset your password.",
    keywords: ["login", "password", "sign in", "locked out", "forgot"],
    body: [
      p("Make sure you're signing in with the email you signed up with. Customers and vendors sign in from different pages."),
      p("If you've forgotten your password, use “Forgot password” on the sign-in page. If your account has been suspended, you'll see a message saying so — contact us if you think it's a mistake."),
      link("/sign-in", "Go to sign in"),
    ],
  },
  {
    slug: "notifications",
    topic: "account",
    title: "Notifications",
    summary: "Turn on notifications to hear about bookings even with GLAMNET closed.",
    keywords: ["notifications", "push", "alerts", "emails", "app"],
    body: [
      p("Install GLAMNET on your phone and turn on notifications to hear when a vendor accepts, when your PIN is ready, or when a request comes in."),
      p("Booking emails are always sent. Marketing emails can be turned off at any time from the link in the email."),
      link("/install", "Get the app"),
    ],
  },
  {
    slug: "delete-account",
    topic: "account",
    title: "Changing details or deleting my account",
    summary: "Update your details from your account; contact us to delete it.",
    keywords: ["delete", "close account", "data", "gdpr", "privacy", "change email"],
    body: [
      p("You can update your name, phone and photo from your account page."),
      p("To delete your account or ask for a copy of your data, contact us using the form below and choose “Account & sign-in”."),
      link("/privacy", "Read our privacy policy"),
    ],
  },
];

export function articleBySlug(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.slug === slug);
}

/** Every word of the query must appear somewhere in the article. */
export function searchArticles(query: string): HelpArticle[] {
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1);
  if (words.length === 0) return [];
  return HELP_ARTICLES.map((article) => {
    const title = article.title.toLowerCase();
    const haystack = [
      article.title,
      article.summary,
      ...(article.keywords ?? []),
      ...article.body.flatMap((block) => (block.kind === "list" ? block.items : block.kind === "p" ? [block.text] : [])),
    ]
      .join(" ")
      .toLowerCase();
    // Loose plurals: "refunds" finds "refund".
    const hit = (word: string) => haystack.includes(word) || (word.endsWith("s") && haystack.includes(word.slice(0, -1)));
    if (!words.every(hit)) return null;
    return { article, score: words.filter((word) => title.includes(word)).length };
  })
    .filter((entry): entry is { article: HelpArticle; score: number } => entry !== null)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.article);
}
