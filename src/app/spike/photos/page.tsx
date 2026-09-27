import { list } from "@vercel/blob";
import Link from "next/link";
import { redirect } from "next/navigation";
import { photoAddresses } from "@/photo/store-photo";
import { hasSpikeAccess } from "@/spike/access";
import { PhotoPicker } from "./photo-picker";

/** ST-002 spike: take or choose a photo, prepare it in the browser, check and store it on the server. */
export default async function SpikePhotos() {
  if (!(await hasSpikeAccess())) redirect("/");
  const { blobs } = await list({ prefix: "spike-photos/" });
  const addresses = await photoAddresses(blobs.map((b) => b.pathname));

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1>Fotos (Spike)</h1>
      <PhotoPicker />
      <ul className="grid grid-cols-2 gap-2">
        {blobs.map((b) => (
          <li key={b.pathname}>
            {/* eslint-disable-next-line @next/next/no-img-element -- private, short-lived addresses; no optimizer */}
            <img src={addresses.get(b.pathname)} alt="" className="w-full" />
            <span className="text-xs">{Math.round(b.size / 1024)} KB</span>
          </li>
        ))}
      </ul>
      <Link href="/">Zurück</Link>
    </main>
  );
}
