/**
 * The business behind GLAMNET, as the legal pages state it.
 *
 * Fill these in once and every page picks them up. Empty fields are left out
 * of the text rather than shown as blanks.
 */
export const LEGAL = {
  /** The trading name customers know. */
  tradingName: "GLAMNET",
  /** Registered company name, e.g. "Glamnet Ltd". Empty until incorporated. */
  companyName: "",
  /** Companies House number. */
  companyNumber: "",
  /** Registered office address. */
  registeredAddress: "",
  /** ICO registration number (data protection fee). */
  icoNumber: "",
  /** Where customers, pros and data requests go. */
  contactEmail: "support@glamnetapp.com",
  /** When the policies last changed. Update with any change to the text. */
  lastUpdated: "25 September 2026",
} as const;

/** "Glamnet Ltd (company 12345678), registered office …" or just the trading name. */
export function whoWeAre(): string {
  const parts: string[] = [];
  if (LEGAL.companyName) {
    parts.push(
      `${LEGAL.tradingName} is operated by ${LEGAL.companyName}` +
        (LEGAL.companyNumber ? ` (company number ${LEGAL.companyNumber})` : "") +
        (LEGAL.registeredAddress ? `, registered office ${LEGAL.registeredAddress}` : "") +
        ".",
    );
  } else {
    parts.push(`${LEGAL.tradingName} ("we", "us") runs the website and app at glamnetapp.com.`);
  }
  return parts.join(" ");
}
