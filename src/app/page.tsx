import Link from "next/link";
import { database } from "@/platform/database";
import { problemReportsOfMachine } from "@/modules/repair";
import { teamMessages, visitorMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";
import { hasSpikeAccess } from "@/spike/access";
import { TEST_MACHINE_ID } from "@/spike/test-machine";
import { enterSpike } from "./actions";
import { ReportProblemForm } from "./report-problem-form";

const { spike } = teamMessages;

export default async function Home({ searchParams }: PageProps<"/">) {
  const { denied } = await searchParams;

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
      <ReportProblemForm messages={visitorMessages("de")} />
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
