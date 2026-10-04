import Link from "next/link";
import { notFound } from "next/navigation";
import { database } from "@/platform/database";
import { currentVisitorMessages } from "../../../visitor-locale";
import { VisitorPage } from "../../../visitor-page";
import { loadReportForm } from "./report-form-data";
import { reportProblemAction } from "./actions";
import { ReportProblemForm } from "./report-problem-form";

/**
 * The report form page (ST-013) at `/m/<museum number>/melden` – a page of its own with nothing but the form (G2a),
 * reached from the visitor machine page, in the visitor's language with the same language switch (ST-010). Public, no
 * login; a machine not on display is refused by CMD-ReportProblem (its visitor machine page offers no button).
 */
export default async function ReportProblemPage({ params }: PageProps<"/m/[museumNumber]/melden">) {
  const museumNumber = decodeURIComponent((await params).museumNumber);
  const [{ locale, messages }, machine] = await Promise.all([
    currentVisitorMessages(),
    loadReportForm(database(), museumNumber),
  ]);
  if (!machine) notFound();
  const machinePage = `/m/${encodeURIComponent(museumNumber)}`;

  return (
    <VisitorPage title={messages.reportForm.title} locale={locale} messages={messages} back={`${machinePage}/melden`}>
      <p className="text-muted-foreground">
        {machine.machineModelTitle} · {museumNumber}
      </p>
      <ReportProblemForm
        action={reportProblemAction.bind(null, museumNumber)}
        messages={{ reportForm: messages.reportForm, commandErrors: messages.commandErrors }}
      />
      <Link href={machinePage} className="self-start text-sm underline underline-offset-4">
        {messages.reportForm.back}
      </Link>
    </VisitorPage>
  );
}
