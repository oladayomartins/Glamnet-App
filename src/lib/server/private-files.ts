import { createHmac } from "node:crypto";
import { imageKitEndpoint } from "@/lib/imagekit";

/**
 * Time-limited links to private media-library files.
 *
 * Compliance documents (insurance certificates, licences) are uploaded as
 * private ImageKit files, which cannot be fetched without a signature. Only
 * the server holds the private key, so only an admin page that asks for a
 * signed link can open one — and the link stops working after `ttlSeconds`.
 *
 * ImageKit's scheme: HMAC-SHA1 over the path after the endpoint, with the
 * expiry timestamp appended, sent as `ik-t` and `ik-s`.
 */
export function signedFileUrl(url: string, ttlSeconds = 600): string {
  const endpoint = imageKitEndpoint();
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY?.trim();
  if (!endpoint || !privateKey || !url.startsWith(`${endpoint}/`)) return url;

  const expire = Math.floor(Date.now() / 1000) + ttlSeconds;
  const path = url.slice(endpoint.length + 1);
  const signature = createHmac("sha1", privateKey).update(`${path}${expire}`).digest("hex");
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}ik-t=${expire}&ik-s=${signature}`;
}
