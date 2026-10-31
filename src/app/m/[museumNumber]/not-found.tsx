import { museumName } from "@/modules/collection";
import { database } from "@/platform/database";
import { currentVisitorMessages } from "../../visitor-locale";
import { UnknownMachineView } from "./unknown-machine";

/** An unknown museum number (ST-010), with HTTP status 404 – see `UnknownMachineView`. */
export default async function UnknownMachine() {
  const [{ locale, messages }, name] = await Promise.all([currentVisitorMessages(), museumName(database())]);
  return <UnknownMachineView museumName={name} locale={locale} messages={messages} />;
}
