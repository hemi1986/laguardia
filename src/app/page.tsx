import Link from "next/link";
import { database } from "@/db/client";
import { problemReportsOfMachine } from "@/modules/repair/problem-reports";
import { hasSpikeAccess } from "@/spike/access";
import { TEST_MACHINE_ID } from "@/spike/test-machine";
import { enterSpike, reportProblemForTestMachine } from "./actions";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { denied, error } = await searchParams;

  if (!(await hasSpikeAccess())) {
    return (
      <main className="p-4">
        <h1>La Guardia</h1>
        <form action={enterSpike}>
          <label>
            Spike-Passwort <input type="password" name="password" required />
          </label>
          <button type="submit">Weiter</button>
          {denied && <p>Falsches Passwort.</p>}
        </form>
      </main>
    );
  }

  const reports = await problemReportsOfMachine(database(), TEST_MACHINE_ID);
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1>La Guardia – Testgerät</h1>
      <form action={reportProblemForTestMachine} className="flex flex-col gap-2">
        <label>
          Problem melden
          <textarea name="description" required className="block w-full border" />
        </label>
        {error === "description-required" && <p>Bitte beschreibe das Problem.</p>}
        <button type="submit">Melden</button>
      </form>
      <ul>
        {reports.map((r) => (
          <li key={r.id}>
            {r.reportedAt.toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}: {r.description}
          </li>
        ))}
      </ul>
      <Link href="/spike/files">Dateien (Spike)</Link>
    </main>
  );
}
