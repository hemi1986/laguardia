import Link from "next/link";
import { redirect } from "next/navigation";
import { hasSpikeAccess } from "@/spike/access";
import { spikeFiles } from "@/spike/files";
import { Uploader } from "./uploader";

/** ST-001 spike: private Blob store – upload directly from the browser, download via 5-minute presigned URLs. */
export default async function SpikeFiles() {
  if (!(await hasSpikeAccess())) redirect("/");
  const files = await spikeFiles();

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1>Dateien (Spike)</h1>
      <Uploader />
      <ul>
        {files.map((f) => (
          <li key={f.pathname}>
            <a href={f.downloadUrl}>{f.pathname}</a> ({(f.size / 1024 / 1024).toFixed(1)} MB)
          </li>
        ))}
      </ul>
      <Link href="/">Zurück</Link>
    </main>
  );
}
