import { Page } from "@/components/page";
import { currentVisitorMessages } from "../../visitor-locale";

/** An unknown museum number (ST-010): said in the visitor's language, with HTTP status 404. */
export default async function UnknownMachine() {
  const { locale, messages } = await currentVisitorMessages();
  return (
    <div lang={locale}>
      <Page title={messages.home.museum}>
        <p>{messages.machinePage.unknown}</p>
      </Page>
    </div>
  );
}
