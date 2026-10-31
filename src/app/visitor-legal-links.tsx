import Link from "next/link";
import type { VisitorMessages } from "@/platform/messages";

/**
 * The links to the legal pages every visitor page shows at its end (ST-064): the privacy notice, and the imprint only if
 * the museum provides one – in German and English alike (ST-103, HS-25).
 */
export function VisitorLegalLinks({ messages, imprintProvided }: { messages: VisitorMessages; imprintProvided: boolean }) {
  const { legal } = messages;
  return (
    <nav aria-label={legal.label} className="flex gap-4 text-sm">
      <Link href="/datenschutz" className="underline underline-offset-4">
        {legal.privacyNoticeLink}
      </Link>
      {imprintProvided && (
        <Link href="/impressum" className="underline underline-offset-4">
          {legal.imprintLink}
        </Link>
      )}
    </nav>
  );
}
