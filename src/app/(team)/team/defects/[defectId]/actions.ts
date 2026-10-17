"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { claimDefectCommand, releaseClaimCommand, resumeDefectCommand } from "@/modules/repair";
import { formAction } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { requireTeamMember } from "../../../../team-session";
import type { DefectButtonState } from "./defect-button-form";
import { defectVersionFields, defectVersionInput } from "./defect-version-input";

export type ClaimDefectState = DefectButtonState<CommandError<typeof claimDefectCommand>>;
export type ReleaseClaimState = DefectButtonState<CommandError<typeof releaseClaimCommand>>;
export type ResumeDefectState = DefectButtonState<CommandError<typeof resumeDefectCommand>>;

/**
 * CMD-ClaimDefect from the defect's page (ST-025) – through the Server Action runner (ST-073), as the signed-in team
 * member. Afterwards the team member is on the defect's page again, which confirms the claim (G3). The page binds the
 * defect's ID; who may claim which defect is the command's.
 */
export async function claimDefectAction(
  defectId: string,
  previous: ClaimDefectState,
  formData: FormData,
): Promise<ClaimDefectState> {
  await requireTeamMember(); // the page's access check
  return formAction(claimDefectCommand, {
    fields: defectVersionFields,
    input: (fields) => defectVersionInput(fields, defectId),
    onSuccess: async (claimed) => {
      revalidatePath("/team/defects");
      redirect(`/team/defects/${claimed.defectId}?done=claim`);
    },
  })(previous, formData);
}

/**
 * CMD-ReleaseClaim from the defect's page (ST-026) – one's own claim („Abgeben“) or, for a technician, someone else's
 * („Übernahme von Tom aufheben“); whose claim may be released by whom is the command's.
 */
export async function releaseClaimAction(
  defectId: string,
  previous: ReleaseClaimState,
  formData: FormData,
): Promise<ReleaseClaimState> {
  await requireTeamMember(); // the page's access check
  return formAction(releaseClaimCommand, {
    fields: defectVersionFields,
    input: (fields) => defectVersionInput(fields, defectId),
    onSuccess: async (released) => {
      revalidatePath("/team/defects");
      redirect(`/team/defects/${released.defectId}?done=release`);
    },
  })(previous, formData);
}

/** CMD-ResumeDefect from the defect's page (ST-029) – one tap („Fortsetzen“); who may resume which defect is the command's. */
export async function resumeDefectAction(
  defectId: string,
  previous: ResumeDefectState,
  formData: FormData,
): Promise<ResumeDefectState> {
  await requireTeamMember(); // the page's access check
  return formAction(resumeDefectCommand, {
    fields: defectVersionFields,
    input: (fields) => defectVersionInput(fields, defectId),
    onSuccess: async (resumed) => {
      revalidatePath("/team/defects");
      redirect(`/team/defects/${resumed.defectId}?done=resume`);
    },
  })(previous, formData);
}
