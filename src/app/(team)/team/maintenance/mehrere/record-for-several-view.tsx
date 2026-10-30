import { BackLink } from "@/components/ui/back-link";
import type { MaintenanceForSeveral } from "@/modules/maintenance";
import { teamMessages } from "@/platform/messages";
import { dueMaintenanceAddress } from "../due-maintenance-data";
import type { RecordForSeveralState } from "./actions";
import { choiceForSeveral } from "./choice-for-several";
import { RecordForSeveralForm } from "./record-for-several-form";

const { recordMaintenance: texts } = teamMessages;

/**
 * The selection page „Für mehrere Geräte erfassen“ (ST-045): it repeats the maintenance task with its instruction and
 * shows the form – which says CMD-RecordMaintenance's reason in its place to someone it would refuse (G11).
 */
export function RecordForSeveralPage({
  data,
  action,
}: {
  data: MaintenanceForSeveral;
  /** The Server Action – none where the page is only looked at (a test of its data). */
  action?: (previous: RecordForSeveralState, formData: FormData) => Promise<RecordForSeveralState>;
}) {
  const { maintenanceTask } = data;
  return (
    <>
      <div className="flex flex-col gap-1 [overflow-wrap:anywhere]">
        <h2 className="text-lg font-semibold">{maintenanceTask.name}</h2>
        <p className="text-sm whitespace-pre-line">{maintenanceTask.instruction}</p>
      </div>
      <RecordForSeveralForm
        action={action ?? (async () => null)}
        maintenanceTaskId={maintenanceTask.id}
        due={data.due}
        others={data.others}
        choice={choiceForSeveral(data)}
        today={data.today}
        earliest={data.earliest}
        whyNot={data.whyNot}
      />
      <BackLink href={dueMaintenanceAddress({ maintenanceTaskId: maintenanceTask.id })}>{texts.back}</BackLink>
    </>
  );
}
