import { teamMessages } from "@/platform/messages";

/**
 * The photo of a problem report on a team page (ST-016) – at its short-lived address, which only team pages issue
 * (HS-1). It opens in full size; the address expires after 5 minutes, a reload issues a new one.
 */
export function ProblemReportPhoto({ address }: { address: string }) {
  return (
    <a href={address} target="_blank" rel="noreferrer" className="self-start">
      {/* A signed, short-lived address of the private store – not something next/image could optimize or cache. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={address} alt={teamMessages.problemReportPhoto.alt} loading="lazy" className="max-h-64 w-auto rounded-md" />
    </a>
  );
}
