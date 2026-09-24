/**
 * Server-side housekeeping for the ImageKit media library.
 *
 * Uploads go straight from the browser to ImageKit, so the only thing the
 * server has to do afterwards is tidy up: when a pro replaces their profile
 * photo or a lookbook image, the old file is deleted rather than left in the
 * library, where it would count against storage forever and stay publicly
 * reachable by its URL.
 *
 * Best-effort by design. A failed delete is logged and forgotten — it must
 * never undo the save the pro just made.
 */

const IMAGEKIT_API = "https://api.imagekit.io/v1/files";

export async function deleteImageKitFiles(fileIds: readonly string[]): Promise<void> {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY?.trim();
  const ids = [...new Set(fileIds.filter(Boolean))];
  if (!privateKey || ids.length === 0) return;

  // Basic auth with the private key as the username and an empty password.
  const authorization = `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`;

  await Promise.all(
    ids.map(async (fileId) => {
      try {
        const response = await fetch(`${IMAGEKIT_API}/${encodeURIComponent(fileId)}`, {
          method: "DELETE",
          headers: { authorization },
          cache: "no-store",
        });
        // 404 means it is already gone, which is the outcome we wanted.
        if (!response.ok && response.status !== 404) {
          console.error("ImageKit delete failed", fileId, response.status);
        }
      } catch (error) {
        console.error("ImageKit delete failed", fileId, error);
      }
    }),
  );
}
