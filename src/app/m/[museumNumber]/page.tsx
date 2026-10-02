import { notFound } from "next/navigation";
import { Page } from "@/components/page";
import { database } from "@/platform/database";
import { currentVisitorMessages } from "../../visitor-locale";
import { VisitorLanguageSwitch } from "../../visitor-language-switch";
import { loadVisitorMachinePage } from "./visitor-machine-page-data";
import { VisitorMachinePage } from "./visitor-machine-page";

/**
 * The visitor machine page (ST-010) at the QR address `/m/<museum number>` (ST-060) – public, no login. It reads the
 * request (its language – and with ST-011 its session), so Next.js renders it for every request and sends
 * `Cache-Control: private, no-cache, no-store, …` itself: never stored by a shared cache. A config header would be
 * overridden; `e2e/visitor-machine-page.spec.ts` checks the real header against the preview. ST-011 adds the machine
 * record for logged-in team members at the same address.
 */
export default async function VisitorMachineRoute({ params }: { params: Promise<{ museumNumber: string }> }) {
  const museumNumber = decodeURIComponent((await params).museumNumber); // Next.js answers 400 for a malformed one
  const [{ locale, messages }, data] = await Promise.all([
    currentVisitorMessages(),
    loadVisitorMachinePage(database(), museumNumber),
  ]);
  if (!data) notFound();

  return (
    <div lang={locale}>
      <Page title={data.machineModelTitle}>
        <VisitorLanguageSwitch locale={locale} messages={messages} back={`/m/${museumNumber}`} />
        <VisitorMachinePage data={data} museumNumber={museumNumber} messages={messages} />
      </Page>
    </div>
  );
}
