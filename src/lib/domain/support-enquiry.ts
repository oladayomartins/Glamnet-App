import type { HelpTopic } from "./help-articles";

/**
 * What a support enquiry can be about. The contact form's dropdowns are built
 * from this, and the API validates against it, so the two can't disagree.
 */

export type EnquirerRole = "CUSTOMER" | "VENDOR" | "OTHER";

export const ENQUIRER_ROLES: { value: EnquirerRole; label: string }[] = [
  { value: "CUSTOMER", label: "I am a customer" },
  { value: "VENDOR", label: "I am a vendor" },
  { value: "OTHER", label: "Something else / not signed up" },
];

export interface EnquiryCategory {
  value: string;
  label: string;
  /** Who sees this option. */
  roles: EnquirerRole[];
  topics: string[];
  /** Ask for a booking reference. */
  askBooking?: boolean;
  /** Knowledge base topic to suggest articles from before they send. */
  helpTopic?: HelpTopic;
  /** Raised straight to the top of the inbox. */
  urgent?: boolean;
}

export const ENQUIRY_CATEGORIES: EnquiryCategory[] = [
  {
    value: "BOOKING",
    label: "A booking",
    roles: ["CUSTOMER", "VENDOR"],
    topics: ["Making a booking", "Changing or rescheduling", "Vendor or client didn't turn up", "Something else about a booking"],
    askBooking: true,
    helpTopic: "booking",
  },
  {
    value: "PAYMENT",
    label: "Payments & refunds",
    roles: ["CUSTOMER"],
    topics: ["I was charged incorrectly", "Where's my refund?", "Card hold question", "Problem with my PIN"],
    askBooking: true,
    helpTopic: "payments",
  },
  {
    value: "CANCELLATION",
    label: "Cancellations",
    roles: ["CUSTOMER", "VENDOR"],
    topics: ["Cancel a booking", "Cancellation fee", "My vendor cancelled", "My client cancelled"],
    askBooking: true,
    helpTopic: "booking",
  },
  {
    value: "SERVICE_PROBLEM",
    label: "A problem with a service",
    roles: ["CUSTOMER"],
    topics: ["Quality of the work", "Behaviour or conduct", "Something else went wrong"],
    askBooking: true,
    helpTopic: "payments",
  },
  {
    value: "SAFETY",
    label: "Safety concern",
    roles: ["CUSTOMER", "VENDOR", "OTHER"],
    topics: ["I felt unsafe", "Report a vendor or client", "Fraud or a scam"],
    askBooking: true,
    urgent: true,
  },
  {
    value: "VENDOR_SETUP",
    label: "Going live & verification",
    roles: ["VENDOR", "OTHER"],
    topics: ["Getting listed", "Verification & documents", "My storefront or menu", "Working hours & calendar"],
    helpTopic: "vendors",
  },
  {
    value: "PAYOUTS",
    label: "Payouts & earnings",
    roles: ["VENDOR"],
    topics: ["Held earnings", "Linking my bank (Stripe)", "A payout is missing", "Fees & commission"],
    askBooking: true,
    helpTopic: "vendors",
  },
  {
    value: "PROMOTIONS",
    label: "Promotions & adverts",
    roles: ["VENDOR"],
    topics: ["Buying a promotion", "A promotion isn't showing", "Advertising with GLAMNET"],
  },
  {
    value: "ACCOUNT",
    label: "Account & sign-in",
    roles: ["CUSTOMER", "VENDOR", "OTHER"],
    topics: ["I can't sign in", "Change my details", "Delete my account or data", "Notifications"],
    helpTopic: "account",
  },
  {
    value: "FEEDBACK",
    label: "Feedback & ideas",
    roles: ["CUSTOMER", "VENDOR", "OTHER"],
    topics: ["Suggest a feature", "Report a bug", "Something you liked"],
  },
  {
    value: "PARTNERSHIP",
    label: "Partnerships & press",
    roles: ["OTHER", "VENDOR"],
    topics: ["Partnership", "Press or media", "Something else"],
  },
  {
    value: "OTHER",
    label: "Something else",
    roles: ["CUSTOMER", "VENDOR", "OTHER"],
    topics: ["General question"],
  },
];

export function categoriesFor(role: EnquirerRole): EnquiryCategory[] {
  return ENQUIRY_CATEGORIES.filter((category) => category.roles.includes(role));
}

export function categoryByValue(value: string): EnquiryCategory | undefined {
  return ENQUIRY_CATEGORIES.find((category) => category.value === value);
}

/** A short code people can quote, e.g. "GN-7K3Q9P". No 0/O/1/I to misread. */
export function enquiryReference(random: () => number = Math.random): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(random() * alphabet.length)];
  return `GN-${code}`;
}
