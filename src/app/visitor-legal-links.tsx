import Link from "next/link";
import type { VisitorMessages } from "@/platform/messages";

/** The links to the legal pages every visitor page shows at its end (ST-064). */
export function VisitorLegalLinks({ messages }: { messages: VisitorMessages }) {
  const { legal } = messages;
  return (
    <nav aria-label={legal.label} className="flex gap-4 text-sm">
      <Link href="/datenschutz" className="underline underline-offset-4">
        {legal.privacyNoticeLink}
      </Link>
    </nav>
  );
}
