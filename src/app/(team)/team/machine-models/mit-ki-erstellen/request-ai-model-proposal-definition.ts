import type { FormDefinition, FormFields } from "@/app/_actions/form-action";
import { requestAiModelProposalCommand, type RequestAiModelProposalInput } from "@/modules/ai-assistance";
import type { CommandError } from "@/platform/command";

/** The one field of the form „Mit KI erstellen“ (ST-123). */
export const requestAiModelProposalFields = ["description"] as const;
export type RequestAiModelProposalField = (typeof requestAiModelProposalFields)[number];

type RequestAiModelProposalCommand = ReturnType<typeof requestAiModelProposalCommand>;

/** What a rejected form's state may hold: the command layer's reasons and the command's own. */
export type RequestAiModelProposalFormError = CommandError<RequestAiModelProposalCommand>;

/** Where a successful request lands: the proposal's own page, which says it is being created (G35). */
export function aiModelProposalAddress(aiModelProposalId: string): string {
  return `/team/machine-models/ki-vorschlag/${encodeURIComponent(aiModelProposalId)}`;
}

/** The typed description as it came – the decision trims it and says when it is blank. */
export function requestAiModelProposalInput(fields: FormFields<RequestAiModelProposalField>): RequestAiModelProposalInput {
  return { description: fields.description ?? "" };
}

/**
 * The form definition of „Mit KI erstellen“ (ST-123): one field, kept as typed after a rejection (G8a). A plain module,
 * so a test can run the real Server Action runner with it.
 */
export function requestAiModelProposalForm({
  onSuccess,
}: {
  onSuccess: (result: { aiModelProposalId: string }) => Promise<void>;
}): FormDefinition<RequestAiModelProposalInput, { aiModelProposalId: string }, RequestAiModelProposalField> {
  return { fields: requestAiModelProposalFields, input: requestAiModelProposalInput, onSuccess };
}
