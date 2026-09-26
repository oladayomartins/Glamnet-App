"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUpload, type UploadedImage } from "@/components/image-upload";

/**
 * The customer's profile photo. Saved the moment it uploads (or is removed),
 * so the header menu picks it up without a separate save step.
 */
export function PhotoPicker({ initial }: { initial: UploadedImage | null }) {
  const router = useRouter();
  const [photo, setPhoto] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const change = async (next: UploadedImage | null) => {
    const previous = photo;
    setPhoto(next);
    setError(null);
    const response = await fetch("/api/customer/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ avatar: next }),
    }).catch(() => null);
    if (response?.ok) {
      router.refresh();
    } else {
      setPhoto(previous);
      setError("That photo didn't save. Try again.");
    }
  };

  return (
    <div>
      <ImageUpload
        folder="customer"
        variant="avatar"
        value={photo}
        onChange={change}
        label="Profile photo"
        hint="Helps your pro recognise you on the day. JPEG, PNG or WebP."
      />
      {error ? (
        <p role="alert" className="mt-2 text-xs text-warning">
          {error}
        </p>
      ) : null}
    </div>
  );
}
