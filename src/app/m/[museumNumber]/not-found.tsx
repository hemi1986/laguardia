import { imprintProvided, museumName } from "@/modules/collection";
import { database } from "@/platform/database";
import { currentVisitorMessages } from "../../visitor-locale";
import { UnknownMachineView } from "./unknown-machine";

/** An unknown museum number (ST-010), with HTTP status 404 – see `UnknownMachineView`. */
export default async function UnknownMachine() {
  const db = database();
  const [{ locale, messages }, name, imprint] = await Promise.all([
    currentVisitorMessages(),
    museumName(db),
    imprintProvided(db),
  ]);
  return <UnknownMachineView museumName={name} locale={locale} messages={messages} imprintProvided={imprint} />;
}
