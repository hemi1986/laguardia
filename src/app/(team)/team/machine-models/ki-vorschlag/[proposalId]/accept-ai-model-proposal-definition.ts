import type { FormFields, ManyFormDefinition } from "@/app/_actions/form-action";
import { versionSeen, wholeNumber } from "@/app/_actions/version";
import { MAX_PROPOSED_DOCUMENTS, type AcceptAiModelProposalInput } from "@/modules/ai-assistance";
import { DOCUMENT_FIELD, documentFileCategoryField, documentTitleField } from "./document-fields";
import { machineModelFields, machineModelInput, type MachineModelField } from "../../machine-model-input";

type DocumentField = ReturnType<typeof documentTitleField> | ReturnType<typeof documentFileCategoryField>;
export type AcceptAiModelProposalField = "aiModelProposalId" | "version" | MachineModelField | DocumentField;

/** The form's own fields: the machine model's, which proposal at which version, and a title and category for each possible document. */
export const acceptAiModelProposalFields: readonly AcceptAiModelProposalField[] = [
  "aiModelProposalId",
  "version",
  ...machineModelFields,
  ...Array.from({ length: MAX_PROPOSED_DOCUMENTS }, (_, index) => [
    documentTitleField(index),
    documentFileCategoryField(index),
  ]).flat(),
];

/**
 * Reads the form (Q19): the machine model's fields as typed, and each ticked document with the title and file category
 * posted for its place. A tick that is no number is the place -1, which no document has – the decision rejects it.
 */
export function acceptAiModelProposalInput(
  fields: FormFields<AcceptAiModelProposalField>,
  chosen: readonly string[],
): AcceptAiModelProposalInput {
  return {
    aiModelProposalId: fields.aiModelProposalId ?? "",
    version: versionSeen(fields.version),
    machineModel: machineModelInput(fields),
    chosen: chosen.map((tick) => {
      const index = wholeNumber(tick) ?? -1;
      return { index, title: fields[documentTitleField(index)], fileCategory: fields[documentFileCategoryField(index)] };
    }),
  };
}

/**
 * The form definition of „Speichern“ (ST-128): one command with all the documents ticked in one field, as posted. A plain
 * module, so a test can run the real Server Action runner with it.
 */
export function acceptAiModelProposalForm({
  onSuccess,
}: {
  onSuccess: (result: { aiModelProposalId: string; machineModelId: string }) => Promise<void>;
}): ManyFormDefinition<
  AcceptAiModelProposalInput,
  { aiModelProposalId: string; machineModelId: string },
  AcceptAiModelProposalField
> {
  return {
    fields: acceptAiModelProposalFields,
    many: { field: DOCUMENT_FIELD },
    input: (fields, chosen) => acceptAiModelProposalInput(fields, chosen),
    onSuccess,
  };
}
