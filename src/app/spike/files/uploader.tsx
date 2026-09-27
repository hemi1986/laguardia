"use client";

import { uploadPresigned } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function Uploader() {
  const router = useRouter();
  const [status, setStatus] = useState("");

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const started = performance.now();
    try {
      await uploadPresigned(`spike/${file.name}`, file, {
        access: "private",
        handleUploadUrl: "/api/spike/upload",
        multipart: file.size > 20 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => setStatus(`${Math.round(percentage)} %`),
      });
      setStatus(`Fertig in ${((performance.now() - started) / 1000).toFixed(1)} s`);
      router.refresh();
    } catch (error) {
      setStatus(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return (
    <div>
      <input type="file" onChange={onChange} />
      <p>{status}</p>
    </div>
  );
}
