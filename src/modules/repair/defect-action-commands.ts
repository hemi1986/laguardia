import type { Command } from "@/platform/command";
import { changeDefectDetailsCommand } from "./change-defect-details-command";
import { claimDefectCommand } from "./claim-defect-command";
import type { DefectAction } from "./defect-actions";
import { logWorkCommand } from "./log-work-command";
import { prioritizeDefectCommand } from "./prioritize-defect-command";
import { putDefectOnHoldCommand } from "./put-defect-on-hold-command";
import { releaseClaimCommand } from "./release-claim-command";
import { reopenDefectCommand } from "./reopen-defect-command";
import { resolveDefectCommand } from "./resolve-defect-command";
import { resumeDefectCommand } from "./resume-defect-command";

/**
 * The command of each action on a defect (architecture review 2026-10-18) – next to its description in
 * `defect-actions.ts`, in a file of its own because the commands load the defect store, which asks those descriptions.
 * Every one names the defect it acted on, so a page can return to it. An assignment is CMD-ClaimDefect for someone else.
 */
export const defectActionCommands = {
  claim: claimDefectCommand,
  release: releaseClaimCommand,
  "log-work": logWorkCommand,
  "put-on-hold": putDefectOnHoldCommand,
  resume: resumeDefectCommand,
  resolve: resolveDefectCommand,
  reopen: reopenDefectCommand,
  assign: claimDefectCommand,
  prioritize: prioritizeDefectCommand,
  "change-details": changeDefectDetailsCommand,
} as const satisfies { readonly [A in DefectAction]: Command<never, { defectId: string }, string> };
