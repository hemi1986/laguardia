import type { PhotosFormDefinition, FormFields } from "@/app/_actions/form-action";
import {
  MAX_AI_ASSESSMENT_PHOTOS,
  requestAiAssessmentCommand,
  type RequestAiAssessmentInput,
} from "@/modules/ai-assistance";
import type { Command, CommandError } from "@/platform/command";
import type { PhotoError } from "@/photo";

/** The text field of the request form – the photos come through the runner's photos step (ST-032). */
export const requestAiAssessmentFields = ["note"] as const;
export type RequestAiAssessmentField = (typeof requestAiAssessmentFields)[number];

type RequestAiAssessmentCommand = ReturnType<typeof requestAiAssessmentCommand>;

/** The command's own reasons, as the form definition declares them – the runner adds its own and the photo errors. */
export type RequestAiAssessmentCommandError =
  RequestAiAssessmentCommand extends Command<never, unknown, infer Error> ? Error : never;

/** What a rejected form's state may hold: the command layer's reasons, the command's own and the photo errors. */
export type RequestAiAssessmentFormError = CommandError<RequestAiAssessmentCommand> | PhotoError;

/** Where a successful request lands: the defect's page, which shows it running (G35). */
export function aiAssessmentLanding(defectId: string): string {
  return `/team/defects/${defectId}`;
}

export function requestAiAssessmentInput(
  defectId: string,
  fields: { note: string | undefined },
  photos: string[],
): RequestAiAssessmentInput {
  return { defectId, note: fields.note ?? "", photos };
}

/**
 * The form definition of „KI-Einschätzung anfordern“ (ST-107): an optional note and at most 5 photos, stored through
 * the photo module like a work log entry's (ADR 0009). It is a plain module so a test can run the real Server Action
 * runner with it and check what a rejection keeps (G8, G8a).
 */
export function requestAiAssessmentForm({
  defectId,
  onSuccess,
}: {
  defectId: string;
  onSuccess: (result: { aiAssessmentId: string }) => Promise<void>;
}): PhotosFormDefinition<
  RequestAiAssessmentInput,
  { aiAssessmentId: string },
  RequestAiAssessmentCommandError,
  RequestAiAssessmentField
> {
  return {
    fields: requestAiAssessmentFields,
    photos: {
      field: "photos",
      owner: "ai-assessments",
      atMost: { count: MAX_AI_ASSESSMENT_PHOTOS, error: "ai-assessment-too-many-photos" },
    },
    input: (fields: FormFields<RequestAiAssessmentField>, photos: string[]) =>
      requestAiAssessmentInput(defectId, fields, photos),
    onSuccess,
  };
}
