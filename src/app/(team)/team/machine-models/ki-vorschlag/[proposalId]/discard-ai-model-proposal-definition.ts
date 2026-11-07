import type { FormDefinition, FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";
import type { DiscardAiModelProposalInput } from "@/modules/ai-assistance";

/** „Verwerfen“ posts which proposal at which version (ST-127) – nothing else. */
export const discardAiModelProposalFields = ["aiModelProposalId", "version"] as const;
export type DiscardAiModelProposalField = (typeof discardAiModelProposalFields)[number];

export function discardAiModelProposalInput(
  fields: FormFields<DiscardAiModelProposalField>,
): DiscardAiModelProposalInput {
  return { aiModelProposalId: fields.aiModelProposalId ?? "", version: versionSeen(fields.version) };
}

/** Where a discarding lands: the machine models page, which confirms it from the journal (G3). */
export const DISCARDED_PARAMETER = "discarded";
export function discardedLanding(aiModelProposalId: string): string {
  return `/team/machine-models?${DISCARDED_PARAMETER}=${encodeURIComponent(aiModelProposalId)}`;
}

/** The form definition of „Verwerfen“ (ST-127). A plain module, so a test can run the real Server Action runner with it. */
export function discardAiModelProposalForm({
  onSuccess,
}: {
  onSuccess: (result: { aiModelProposalId: string }) => Promise<void>;
}): FormDefinition<DiscardAiModelProposalInput, { aiModelProposalId: string }, DiscardAiModelProposalField> {
  return { fields: discardAiModelProposalFields, input: discardAiModelProposalInput, onSuccess };
}
