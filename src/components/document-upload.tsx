"use client";

import { useRef, useState } from "react";
import { upload, ImageKitAbortError, ImageKitServerError } from "@imagekit/next";
import { FileArrowUp } from "@phosphor-icons/react";

export interface UploadedDocument {
  url: string;
  fileId: string;
  fileName: string;
  mimeType: string;
}

/** The certification upload gate accepts photos or PDFs, nothing else. */
export const DOCUMENT_ACCEPT = "image/*,application/pdf";
const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

/**
 * Upload an insurance certificate or practitioner licence.
 *
 * Uploaded as a *private* media-library file: it has no public URL, and an
 * admin opens it through a short-lived signed link. A vendor's insurance
 * policy is personal data and must not be fetchable by anyone who guesses
 * the path.
 */
export function DocumentUpload({
  onUploaded,
  disabled,
}: {
  onUploaded: (document: UploadedDocument) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File) => {
    setError(null);
    if (!(file.type.startsWith("image/") || file.type === "application/pdf")) {
      setError("Upload a photo or a PDF of the document.");
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setError("That file is over 15MB. Try a smaller scan or a PDF.");
      return;
    }

    setProgress(0);
    try {
      const authResponse = await fetch("/api/imagekit/auth");
      const auth = await authResponse.json();
      if (!authResponse.ok) throw new Error(auth.error?.message ?? "Could not start the upload.");

      const result = await upload({
        file,
        fileName: file.name,
        folder: "/glamnet/compliance",
        useUniqueFileName: true,
        isPrivateFile: true,
        token: auth.token,
        signature: auth.signature,
        expire: auth.expire,
        publicKey: auth.publicKey,
        onProgress: (event) => setProgress(Math.round((event.loaded / event.total) * 100)),
      });
      if (!result.url || !result.fileId) throw new Error("The upload did not finish.");
      onUploaded({
        url: result.url,
        fileId: result.fileId,
        fileName: file.name,
        mimeType: file.type,
      });
    } catch (cause) {
      if (cause instanceof ImageKitAbortError) return;
      setError(
        cause instanceof ImageKitServerError
          ? "The file service rejected that upload."
          : cause instanceof Error
            ? cause.message
            : "That upload did not finish.",
      );
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || progress !== null}
        className="tap-44 flex w-full items-center justify-center gap-2 rounded-glam border border-dashed border-line bg-surface px-4 py-5 text-sm font-medium text-ink-muted transition hover:border-accent-500 hover:text-ink disabled:opacity-50"
      >
        <FileArrowUp size={18} weight="bold" aria-hidden />
        {progress !== null ? `Uploading… ${progress}%` : "Upload a photo or PDF"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={DOCUMENT_ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void pick(file);
        }}
      />
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-warning">
          {error}
        </p>
      ) : null}
    </div>
  );
}
