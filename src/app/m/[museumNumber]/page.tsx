import { notFound } from "next/navigation";
import { Page } from "@/components/page";
import { database } from "@/platform/database";
import { currentVisitorMessages } from "../../visitor-locale";
import { VisitorLanguageSwitch } from "../../visitor-language-switch";
import { loadVisitorMachinePage } from "./visitor-machine-page-data";
import { VisitorMachinePage } from "./visitor-machine-page";

/**
 * The visitor machine page (ST-010) at the QR address `/m/<museum number>` (ST-060) – public, no login. Rendered for
 * every request (it reads the request's language), so it is never served from a shared cache. ST-011 adds the
 * machine record for logged-in team members at the same address.
 */
export default async function VisitorMachineRoute({ params }: { params: Promise<{ museumNumber: string }> }) {
  const museumNumber = decodeURIComponent((await params).museumNumber);
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
