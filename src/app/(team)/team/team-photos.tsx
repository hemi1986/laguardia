import { teamMessages } from "@/platform/messages";
import type { ContentStorage } from "@/platform/storage";

/** Where a team page's data reads photos from – Vercel Blob unless a test injects the in-memory adapter (ST-016). */
export type PhotoSource = { storage?: ContentStorage };

/** A problem report's photo at its address – none when it has no photo, or no address could be issued. */
export function photoAt(addresses: Map<string, string>, photo: string | undefined): { address: string } | undefined {
  const address = photo && addresses.get(photo);
  return address ? { address } : undefined;
}

/**
 * The photo of a problem report on a team page (ST-016) – at its short-lived address, which only team pages issue
 * (HS-1). It opens in full size; the address expires after 5 minutes, a reload issues a new one.
 */
export function ProblemReportPhoto({ address }: { address: string }) {
  return <TeamPhoto address={address} alt={teamMessages.problemReportPhoto.alt} />;
}

/** The photos of a work log entry (ST-032), under it – each like a problem report's. */
export function WorkLogPhotos({ photos }: { photos: { address: string }[] }) {
  if (photos.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {photos.map(({ address }) => (
        <li key={address}>
          <TeamPhoto address={address} alt={teamMessages.workLogPhoto.alt} />
        </li>
      ))}
    </ul>
  );
}

/** The photos that came with an AI assessment's request (ST-107) – each like a work log entry's. */
export function AiAssessmentPhotos({ photos }: { photos: { address: string }[] }) {
  if (photos.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {photos.map(({ address }) => (
        <li key={address}>
          <TeamPhoto address={address} alt={teamMessages.aiAssessments.photoAlt} />
        </li>
      ))}
    </ul>
  );
}

function TeamPhoto({ address, alt }: { address: string; alt: string }) {
  return (
    <a href={address} target="_blank" rel="noreferrer" className="self-start">
      {/* A signed, short-lived address of the private store – not something next/image could optimize or cache. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={address} alt={alt} loading="lazy" className="max-h-64 w-auto rounded-md" />
    </a>
  );
}
