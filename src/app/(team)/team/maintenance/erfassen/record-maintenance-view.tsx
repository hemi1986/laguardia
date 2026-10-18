import Link from "next/link";
import { teamMessages } from "@/platform/messages";
import type { RecordMaintenanceState } from "./actions";
import type { RecordMaintenancePageData } from "./record-maintenance-data";
import { RecordMaintenanceForm } from "./record-maintenance-form";

const { recordMaintenance: texts } = teamMessages;

/**
 * The form page „Wartung erfassen“ (ST-044): it repeats the maintenance task with its instruction and the machine, and
 * shows the form – which says CMD-RecordMaintenance's reason in its place to someone it would refuse (G11).
 */
export function RecordMaintenancePage({
  data,
  action,
}: {
  data: RecordMaintenancePageData;
  /** The Server Action – none where the page is only looked at (a test of its data). */
  action?: (previous: RecordMaintenanceState, formData: FormData) => Promise<RecordMaintenanceState>;
}) {
  const { maintenanceTask, machine } = data;
  return (
    <>
      <div className="flex flex-col gap-1 [overflow-wrap:anywhere]">
        <h2 className="text-lg font-semibold">{maintenanceTask.name}</h2>
        <p className="text-sm whitespace-pre-line">{maintenanceTask.instruction}</p>
        <p className="text-muted-foreground text-sm">
          {machine.museumNumber} · {machine.machineModelTitle} · {machine.location}
        </p>
      </div>
      <RecordMaintenanceForm
        action={action ?? (async () => null)}
        maintenanceTaskId={maintenanceTask.id}
        machineId={machine.id}
        today={data.today}
        earliest={data.earliest}
        whyNot={data.whyNot}
      />
      <Link
        href={`/team/maintenance?task=${encodeURIComponent(maintenanceTask.id)}`}
        className="self-start text-sm underline underline-offset-4"
      >
        {texts.back}
      </Link>
    </>
  );
}
