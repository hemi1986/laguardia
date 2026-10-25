import { defectActions, type DefectAction, type DefectActionInCommand } from "@/modules/repair";
import { teamMessages } from "@/platform/messages";

const { defects: texts } = teamMessages;

/** What a confirmation can name besides the title – the defect as it is now, and the names the page put to IDs. */
export type ConfirmationAbout = {
  assignedTo: string;
  priority: string;
  holdReason: string;
  suitableForHelpers: boolean;
  /** Repair's answer, with the name of whose claim it released. */
  changedDetails: DefectActionInCommand["changedDetails"];
};

type ActionPage = {
  /** Its form page (G21), if it has one: the folder under the defect's page and what its button says (G14). */
  form?: { path: string; label: string };
  /** What the defect's page says to who just did it (G3). */
  confirmation: (title: string, about: ConfirmationAbout) => string;
};

/**
 * Each action on a defect in the app (architecture review 2026-10-18) – Repair says what the action is (its command,
 * refusal and event), this says how it looks. **A new action** adds its entry here, and its form folder if it has one.
 */
export const defectActionPages = {
  claim: { confirmation: texts.claimed },
  release: { confirmation: texts.released },
  "log-work": { form: { path: "arbeitsschritt", label: texts.logWork }, confirmation: texts.workLogged },
  "put-on-hold": {
    form: { path: "pausieren", label: texts.putOnHold },
    confirmation: (title, { holdReason }) => texts.putOnHoldDone(title, holdReason),
  },
  resume: { confirmation: texts.resumed },
  resolve: { form: { path: "beheben", label: texts.resolve }, confirmation: texts.resolved },
  reopen: { form: { path: "wieder-oeffnen", label: texts.reopen }, confirmation: texts.reopened },
  assign: {
    form: { path: "zuweisen", label: texts.assign },
    confirmation: (title, { assignedTo }) => texts.assigned(title, assignedTo),
  },
  prioritize: {
    form: { path: "prioritaet", label: texts.prioritize },
    confirmation: (title, { priority }) => texts.prioritized(title, priority),
  },
  "change-details": {
    form: { path: "titel-und-eignung", label: texts.changeDetails },
    // One sentence per change, then the claim it released (ST-031).
    confirmation: (title, { changedDetails, suitableForHelpers }) =>
      [
        changedDetails?.title && texts.titleChanged(title),
        changedDetails?.suitableForHelpers &&
          (suitableForHelpers ? texts.nowSuitableForHelpers(title) : texts.noLongerSuitableForHelpers(title)),
        changedDetails?.releasedClaimOf && texts.claimOfReleased(changedDetails.releasedClaimOf),
      ]
        .filter(Boolean)
        .join(" "),
  },
} as const satisfies { readonly [A in DefectAction]: ActionPage };

/** The actions with a form page of their own. */
export type ActionWithFormPage = {
  [A in DefectAction]: (typeof defectActionPages)[A] extends { form: object } ? A : never;
}[DefectAction];

/** The address of an action's form page on a defect. */
export function defectFormAddress(defectId: string, action: ActionWithFormPage): string {
  return `/team/defects/${defectId}/${defectActionPages[action].form.path}`;
}

/** The defect's page after an action – `done` names it; the page confirms it only when the journal says so too (G3). */
export function defectDoneAddress(defectId: string, action: DefectAction): string {
  return `/team/defects/${defectId}?done=${action}`;
}

/** The action an address's `done` names – none for anything that is not one. The counterpart of `defectDoneAddress`. */
export function doneActionOf(value: string | string[] | undefined): DefectAction | undefined {
  return defectActions.find((action) => action === value);
}
