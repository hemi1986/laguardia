import type { FormDefinition, FormFields } from "@/app/_actions/form-action";
import { versionSeen, wholeNumber } from "@/app/_actions/version";
import type { RetryProposedDocumentInput } from "@/modules/ai-assistance";

/** „Nochmal versuchen“ posts which proposal at which version and which link, by its place (ST-130) – nothing else. */
export const retryProposedDocumentFields = ["aiModelProposalId", "index", "version"] as const;
export type RetryProposedDocumentField = (typeof retryProposedDocumentFields)[number];

export function retryProposedDocumentInput(fields: FormFields<RetryProposedDocumentField>): RetryProposedDocumentInput {
  // A place that is no whole number names no link: the command refuses it like any link that did not fail.
  return {
    aiModelProposalId: fields.aiModelProposalId ?? "",
    index: wholeNumber(fields.index) ?? -1,
    version: versionSeen(fields.version),
  };
}

/** The form definition of „Nochmal versuchen“ (ST-130). A plain module, so a test can run the real Server Action runner with it. */
export function retryProposedDocumentForm({
  onSuccess,
}: {
  onSuccess: (result: { aiModelProposalId: string }) => Promise<void>;
}): FormDefinition<RetryProposedDocumentInput, { aiModelProposalId: string }, RetryProposedDocumentField> {
  return { fields: retryProposedDocumentFields, input: retryProposedDocumentInput, onSuccess };
}
