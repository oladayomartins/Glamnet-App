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
  capture,
  variant = "tile",
}: {
  folder: ImageFolder;
  value: UploadedImage | null;
  onChange: (image: UploadedImage | null) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  /** Open the phone's camera directly rather than the photo library. */
  capture?: "environment" | "user";
  /** "avatar" draws a round profile-photo picker instead of the wide tile. */
  variant?: "tile" | "avatar" | "portrait";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Drag-and-drop on desktop, alongside the click-to-choose picker.
  const dropProps = {
    onDragOver: (event: React.DragEvent) => {
      event.preventDefault();
      if (!disabled) setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file && !disabled) void pick(file);
    },
  };

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

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPTED_IMAGE_TYPES.join(",")}
      capture={capture}
      className="sr-only"
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void pick(file);
      }}
    />
  );

  if (variant === "avatar") {
    return (
      <div className="flex items-center gap-4">
        <button
          type="button"
          {...dropProps}
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
          aria-label={value ? "Change profile photo" : "Add a profile photo"}
          className={`group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full transition duration-[240ms] ease-glam ${
            value ? "ring-2 ring-accent-500" : "border-2 border-dashed border-line bg-surface hover:border-accent-500"
          } ${dragging ? "scale-105 border-accent-500 ring-4 ring-accent-500/30" : ""}`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- a just-uploaded preview
            <img src={`${value.url}?tr=w-192,h-192,fo-face`} alt="" className="pop-in h-full w-full object-cover" />
          ) : (
            <UploadSimple size={22} className="text-ink-muted transition group-hover:text-accent-700" aria-hidden />
          )}
          {busy ? (
            <span className="absolute inset-0 flex items-center justify-center bg-obsidian/60 font-mono text-xs font-bold text-on-obsidian">
              {progress}%
            </span>
          ) : null}
        </button>
        <div>
          <span className="block text-sm font-medium text-ink">{label}</span>
          <span className="mt-0.5 block text-xs text-ink-muted">
            {hint ?? "JPEG, PNG or WebP, up to 10MB. Drag it here or tap to choose."}
          </span>
          {value ? (
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={disabled}
              className="tap-44 mt-1 text-xs font-semibold text-ink-muted hover:text-ink"
            >
              Remove photo
            </button>
          ) : null}
          {error ? (
            <p role="alert" className="mt-1 text-xs text-warning">
              {error}
            </p>
          ) : null}
        </div>
        {input}
      </div>
    );
  }

  if (variant === "portrait") {
    return (
      <div>
        <span className="text-sm font-medium text-ink">{label}</span>
        <div
          {...dropProps}
          className={`group relative mt-1.5 aspect-[4/5] overflow-hidden rounded-glam-lg transition duration-[240ms] ease-glam ${
            value
              ? "ring-1 ring-line"
              : `border-2 border-dashed ${dragging ? "border-accent-500 bg-accent-100/40" : "border-line bg-surface hover:border-accent-500"}`
          }`}
        >
          {value ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- a just-uploaded preview */}
              <img src={`${value.url}?tr=w-480,h-600,fo-auto`} alt="" className="pop-in h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-obsidian/80 to-transparent p-3 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={disabled || busy}
                  className="rounded-full bg-surface/90 px-3 py-1.5 text-xs font-semibold text-ink backdrop-blur"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => onChange(null)}
                  disabled={disabled}
                  aria-label="Remove image"
                  className="rounded-full bg-surface/90 p-1.5 text-ink backdrop-blur"
                >
                  <Trash size={14} weight="bold" />
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || busy}
              className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-sm font-medium text-ink-muted transition group-hover:text-accent-700"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sunken">
                <ImageIcon size={20} aria-hidden />
              </span>
              {dragging ? "Drop to upload" : "Choose or drop a photo"}
            </button>
          )}
          {busy ? (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-obsidian/70 text-on-obsidian">
              <span className="font-mono text-sm font-bold">{progress}%</span>
              <span className="h-1 w-24 overflow-hidden rounded-full bg-white/20">
                <span className="block h-full bg-metal transition-[width] duration-200" style={{ width: `${progress}%` }} />
              </span>
            </span>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="mt-1.5 text-xs text-warning">
            {error}
          </p>
        ) : null}
        {input}
      </div>
    );
  }

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
          {...dropProps}
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
          className={`tap-44 mt-1.5 flex w-full items-center justify-center gap-2 rounded-glam border border-dashed px-4 py-5 text-sm font-medium transition duration-[180ms] ease-glam disabled:opacity-50 ${
            dragging
              ? "border-accent-500 bg-accent-100/40 text-accent-700"
              : "border-line bg-surface text-ink-muted hover:border-accent-500 hover:text-accent-700"
          }`}
        >
          {busy ? (
            <>
              <ImageIcon size={18} weight="bold" />
              Uploading… {progress}%
            </>
          ) : (
            <>
              <UploadSimple size={18} weight="bold" />
              {dragging ? "Drop to upload" : "Choose or drop an image"}
            </>
          )}
        </button>
      )}

      {input}

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
