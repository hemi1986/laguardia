import Link from "next/link";
import { database } from "@/platform/database";
import { problemReportsOfMachine } from "@/modules/repair";
import { commandErrorText, teamMessages, visitorMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";
import { hasSpikeAccess } from "@/spike/access";
import { TEST_MACHINE_ID } from "@/spike/test-machine";
import { enterSpike, reportProblemForTestMachine } from "./actions";

const { spike } = teamMessages;
const visitor = visitorMessages("de");
const { problemReport } = visitor;

export default async function Home({ searchParams }: PageProps<"/">) {
  const { denied, error } = await searchParams;

  if (!(await hasSpikeAccess())) {
    return (
      <main className="p-4">
        <h1>La Guardia</h1>
        <form action={enterSpike}>
          <label>
            {spike.password} <input type="password" name="password" required />
          </label>
          <button type="submit">{spike.enter}</button>
          {denied && <p>{spike.wrongPassword}</p>}
        </form>
      </main>
    );
  }

  const reports = await problemReportsOfMachine(database(), TEST_MACHINE_ID);
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1>{spike.testMachineTitle}</h1>
      <form action={reportProblemForTestMachine} className="flex flex-col gap-2">
        <label>
          {problemReport.label}
          <textarea name="description" required className="block w-full border" />
        </label>
        {error === "description-required" && <p>{commandErrorText(visitor, error)}</p>}
        <button type="submit">{problemReport.submit}</button>
      </form>
      <ul>
        {reports.map((r) => (
          <li key={r.id}>
            {formatDateTime(r.reportedAt)}: {r.description}
          </li>
        ))}
      </ul>
      <Link href="/spike/files">{spike.files}</Link>
      <Link href="/spike/photos">{spike.photos}</Link>
    </main>
  );
}
