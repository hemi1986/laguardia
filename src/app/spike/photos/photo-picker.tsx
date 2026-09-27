"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PHOTO_LIMITS } from "@/photo/limits";
import { PhotoNotReadableError, PhotoTooLargeError, preparePhoto } from "@/photo/prepare-photo";
import { uploadPhoto, type UploadPhotoResult } from "./actions";

const errors: Record<Exclude<UploadPhotoResult, { ok: true }>["error"], string> = {
  "not-authorized": "Nicht angemeldet.",
  missing: "Kein Foto ausgewählt.",
  "too-large": "Das Foto ist zu groß.",
  "not-an-image": "Das ist kein Foto.",
  "unsupported-format": "Dieses Bildformat wird nicht unterstützt (JPEG, PNG oder WebP).",
};

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

export function PhotoPicker() {
  const router = useRouter();
  const [status, setStatus] = useState<string[]>([]);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const lines = [`Original: ${file.type || "unbekannt"}, ${kb(file.size)}`];
    setStatus([...lines, "Wird vorbereitet …"]);
    try {
      const t0 = performance.now();
      const prepared = await preparePhoto(file);
      const t1 = performance.now();
      lines.push(`Verkleinert: ${kb(prepared.size)} in ${Math.round(t1 - t0)} ms`);
      setStatus([...lines, "Wird hochgeladen …"]);
      const form = new FormData();
      form.append("photo", prepared, "photo.jpg");
      const result = await uploadPhoto(form);
      const t2 = performance.now();
      if (!result.ok) {
        setStatus([...lines, `Fehler: ${errors[result.error]}`]);
        return;
      }
      lines.push(
        `Gespeichert: ${result.width}×${result.height}, ${kb(result.bytes)}`,
        `Hochladen: ${Math.round(t2 - t1)} ms (Server ${result.serverMs} ms) · gesamt ${((t2 - t0) / 1000).toFixed(1)} s`,
      );
      setStatus(lines);
      router.refresh();
    } catch (error) {
      setStatus([
        ...lines,
        error instanceof PhotoTooLargeError
          ? `Fehler: Das Foto ist zu groß (höchstens ${PHOTO_LIMITS.maxOriginalBytes / 1_000_000} MB).`
          : error instanceof PhotoNotReadableError
            ? "Fehler: Dieses Foto kann der Browser nicht lesen (z. B. HEIC). Bitte als JPEG aufnehmen."
            : `Fehler: ${error instanceof Error ? error.message : String(error)}`,
      ]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="rounded border p-2 text-center">
        Foto aufnehmen
        <input type="file" accept="image/*" capture="environment" onChange={onChange} className="hidden" />
      </label>
      <label className="rounded border p-2 text-center">
        Foto auswählen
        <input type="file" accept="image/*" onChange={onChange} className="hidden" />
      </label>
      <ul className="text-sm">
        {status.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
