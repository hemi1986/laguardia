import { eventCatalogue } from "@/platform/command";
import type { DefectClaimed } from "./claim-defect";
import type { ProblemReportDismissed } from "./dismiss-problem-report";
import type { ProblemReportLinkedToDefect } from "./link-problem-report-to-defect";
import type { WorkLogged } from "./log-work";
import type { DefectPrioritized } from "./prioritize-defect";
import type { DefectRecorded } from "./record-defect";
import type { DefectClaimReleased } from "./release-claim";
import type { ProblemReported } from "./report-problem";
import type { DefectResolved } from "./resolve-defect";
import type { ProblemResolvedOnTheSpot } from "./resolve-problem-on-the-spot";

/**
 * Repair's event catalogue (ST-079, architecture review 2026-10-17): per event its aggregate and what reaches the
 * journal – references and facts from fixed lists only. Descriptions, notes, closing notes and what was done are typed
 * text and stay in the aggregates (ST-003). A new Repair event is added here; its command passes `repairEvents.journal`.
 */
export const repairEvents = eventCatalogue({
  "EVT-ProblemReported": {
    aggregate: "AGG-ProblemReport",
    // The reporter is the journal's actor; the description stays in the problem report only.
    project: (event: ProblemReported) => ({ aggregateId: event.problemReportId, machineId: event.machineId, data: {} }),
  },
  "EVT-DefectRecorded": {
    aggregate: "AGG-ProblemReport",
    project: (event: DefectRecorded) => ({
      aggregateId: event.problemReportId,
      machineId: event.machineId,
      data: { defectId: event.defectId, priority: event.priority, suitableForHelpers: event.suitableForHelpers },
    }),
  },
  "EVT-ProblemReportLinkedToDefect": {
    aggregate: "AGG-ProblemReport",
    project: (event: ProblemReportLinkedToDefect) => ({
      aggregateId: event.problemReportId,
      machineId: event.machineId,
      data: { defectId: event.defectId },
    }),
  },
  "EVT-ProblemResolvedOnTheSpot": {
    aggregate: "AGG-ProblemReport",
    project: (event: ProblemResolvedOnTheSpot) => ({
      aggregateId: event.problemReportId,
      machineId: event.machineId,
      data: {},
    }),
  },
  "EVT-ProblemReportDismissed": {
    aggregate: "AGG-ProblemReport",
    // The reason is a fact from a fixed list; its free text is typed and lives in the problem report.
    project: (event: ProblemReportDismissed) => ({
      aggregateId: event.problemReportId,
      machineId: event.machineId,
      data: { reason: event.reason },
    }),
  },
  "EVT-DefectClaimed": {
    aggregate: "AGG-Defect",
    // Whom the defect was taken over from is kept nowhere else – the Claim holds who claims it now (data model).
    project: (event: DefectClaimed) => ({
      aggregateId: event.defectId,
      machineId: event.machineId,
      data: {
        claimedBy: event.claimedBy,
        ...(event.takenOverFrom ? { takenOverFrom: event.takenOverFrom } : {}),
        ...(event.assignedBy ? { assignedBy: event.assignedBy } : {}),
      },
    }),
  },
  "EVT-DefectClaimReleased": {
    aggregate: "AGG-Defect",
    // Whose claim ended is kept nowhere else once the claim is gone (story review 2026-10-17, ST-086); who released
    // it is the journal's actor.
    project: (event: DefectClaimReleased) => ({
      aggregateId: event.defectId,
      machineId: event.machineId,
      data: { formerClaimant: event.formerClaimant },
    }),
  },
  "EVT-WorkLogged": {
    aggregate: "AGG-Defect",
    project: (event: WorkLogged) => ({
      aggregateId: event.defectId,
      machineId: event.machineId,
      data: { workLogEntryId: event.workLogEntryId, loggedBy: event.loggedBy },
    }),
  },
  "EVT-DefectResolved": {
    aggregate: "AGG-Defect",
    project: (event: DefectResolved) => ({
      aggregateId: event.defectId,
      machineId: event.machineId,
      data: { resolvedBy: event.resolvedBy },
    }),
  },
  "EVT-DefectPrioritized": {
    aggregate: "AGG-Defect",
    project: (event: DefectPrioritized) => ({
      aggregateId: event.defectId,
      machineId: event.machineId,
      data: { priority: event.priority },
    }),
  },
});
