"use client";

import { useRef, useState } from "react";
import { upload, ImageKitAbortError, ImageKitServerError } from "@imagekit/next";
import { Image as ImageIcon, Trash, UploadSimple } from "@phosphor-icons/react";
import {
  ACCEPTED_IMAGE_TYPES,
  IMAGE_FOLDERS,
  MAX_IMAGE_BYTES,
  type ImageFolder,
} from "@/lib/imagekit";

export interface UploadedImage {
  url: string;
  fileId: string;
}

/**
 * Direct-to-ImageKit upload.
 *
 * The file goes from the browser to ImageKit without passing through our
 * server, which keeps a 10 MB phone photo off the serverless function's
 * request body. The server's only involvement is signing a short-lived,
 * authenticated token.
 */
export function ImageUpload({
  folder,
  value,
  onChange,
  label,
  hint,
  disabled,
}: {
  folder: ImageFolder;
  value: UploadedImage | null;
  onChange: (image: UploadedImage | null) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File) => {
    setError(null);

    // Checked here for a fast, clear message; ImageKit enforces its own
    // limits server-side regardless, so this is convenience, not security.
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as never)) {
      setError("That file type is not supported. Use a JPEG, PNG or WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(
        `That image is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is ${
          MAX_IMAGE_BYTES / 1024 / 1024
        }MB.`,
      );
      return;
    }

    setProgress(0);
    try {
      const authResponse = await fetch("/api/imagekit/auth");
      if (!authResponse.ok) {
        const payload = await authResponse.json().catch(() => null);
        throw new Error(
          payload?.error?.message ?? "Could not start the upload.",
        );
      }
      const { token, signature, expire, publicKey } = await authResponse.json();

      const result = await upload({
        file,
        fileName: file.name,
        folder: IMAGE_FOLDERS[folder],
        // The browser cannot be trusted to name files uniquely, and a
        // collision would silently overwrite someone else's image.
        useUniqueFileName: true,
        token,
        signature,
        expire,
        publicKey,
        onProgress: (event) => {
          setProgress(Math.round((event.loaded / event.total) * 100));
        },
      });

      if (result.url && result.fileId) {
        onChange({ url: result.url, fileId: result.fileId });
      } else {
        throw new Error("The upload finished without returning an image.");
      }
    } catch (cause) {
      if (cause instanceof ImageKitAbortError) return;
      setError(
        cause instanceof ImageKitServerError
          ? "The image service rejected that upload. Try a different image."
          : cause instanceof Error
            ? cause.message
            : "That upload did not finish.",
      );
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const busy = progress !== null;

  return (
    <div>
      <span className="text-sm font-medium text-ink">{label}</span>

      {value ? (
        <div className="mt-1.5 flex items-center gap-3 rounded-glam border border-line bg-surface p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- a just-uploaded
              preview, sized by CSS; next/image adds nothing here. */}
          <img
            src={`${value.url}?tr=w-96,h-96,fo-auto`}
            alt=""
            className="h-16 w-16 shrink-0 rounded-glam-sm object-cover"
          />
          <p className="flex-1 text-sm text-ink-muted">Image attached</p>
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="tap-44 inline-flex items-center gap-1.5 rounded-glam-sm px-3 py-2 text-sm font-medium text-ink-muted transition hover:text-ink"
          >
            <Trash size={16} weight="bold" />
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
          className="tap-44 mt-1.5 flex w-full items-center justify-center gap-2 rounded-glam border border-dashed border-line bg-surface px-4 py-5 text-sm font-medium text-ink-muted transition hover:border-brand-400 hover:text-brand-700 disabled:opacity-50"
        >
          {busy ? (
            <>
              <ImageIcon size={18} weight="bold" />
              Uploading… {progress}%
            </>
          ) : (
            <>
              <UploadSimple size={18} weight="bold" />
              Choose an image
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void pick(file);
        }}
      />

      {hint && !error ? (
        <span className="mt-1 block text-xs text-ink-muted">{hint}</span>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-1.5 rounded-glam border-l-4 border-warning bg-sunken p-2 text-xs text-ink"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
