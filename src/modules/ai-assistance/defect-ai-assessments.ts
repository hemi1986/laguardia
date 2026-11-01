import { filesForAiReferences } from "@/modules/collection";
import { defectForAiAssessmentRequest, type DefectForAiAssessmentRequest } from "@/modules/repair";
import type { Database } from "@/platform/command";
import type { Role } from "@/platform/command";
import type {
  AiAssessmentReference,
  AiAssessmentState,
  RequestAiAssessmentError,
  RequestAiAssessmentInput,
} from "./ai-assessment";
import { aiAssessmentBeingWritten, aiAssessmentsOfDefect, newestAiAssessmentOf } from "./ai-assessments";
import { aiAssessmentSettings, type AiDependencies } from "./ai-settings";

/**
 * RM-DefectAiAssessments (ST-107): the section „KI-Einschätzungen“ of a defect's page. It shows the newest AI assessment
 * (being written, otherwise the newest written or failed) and whether the team member looking at the page may request
 * one. The section is shown only when they may request – AI on, defect open, technician or a defect suitable for
 * helpers, and none being written (G11) – or the defect has at least one, which stays readable while AI is off (G37).
 */

export type ShownAiAssessmentReference = AiAssessmentReference & {
  /** The file's title from Collection – a removed file keeps it (ST-108 shows it without a link). */
  title: string;
  removed: boolean;
};

export type ShownAiAssessment = Pick<
  AiAssessmentState,
  | "id"
  | "state"
  | "note"
  | "photos"
  | "requestedBy"
  | "requestedAt"
  | "chatModel"
  | "summary"
  | "probableCauses"
  | "whatToCheckFirst"
  | "cost"
  | "changedAt"
  | "failureReason"
> & {
  /** The chat model's name for the line under the assessment – none when OpenRouter cannot name it now. */
  chatModelName: string | undefined;
  /** Its references with the files' titles, in the order the AI named them. */
  references: ShownAiAssessmentReference[];
};

export type DefectAiAssessments = {
  /** Nothing to show: the viewer may not request and the defect has no AI assessment (RM-DefectAiAssessments). */
  shown: boolean;
  /** Whether to offer „KI-Einschätzung anfordern“ – AI on, the defect open, allowed, none being written (HS-31). */
  mayRequest: boolean;
  /** Why CMD-RequestAiAssessment would refuse the viewer now – the form page shows it in place of the form (G11). */
  refusal: RequestAiAssessmentError | undefined;
  /** The newest AI assessment; while it is being written the page refreshes itself. */
  current: ShownAiAssessment | undefined;
};

/** Who looks at the page – the rule for helpers is the request command's own (G11). */
export type AiAssessmentViewer = { teamMemberId: string; role: Role };

export async function defectAiAssessments(
  db: Database,
  {
    defectId,
    viewer,
    dependencies,
  }: { defectId: string; viewer: AiAssessmentViewer | undefined; dependencies: AiDependencies },
): Promise<DefectAiAssessments> {
  const [settings, defect, beingWritten, newest] = await Promise.all([
    aiAssessmentSettings(db, dependencies),
    defectForAiAssessmentRequest(db, defectId),
    aiAssessmentBeingWritten(db, defectId),
    newestAiAssessmentOf(db, defectId),
  ]);
  const refusal = requestRefusal(settings, defect, viewer, beingWritten);
  const current = newest && (await shown(db, newest, dependencies));
  return { shown: !refusal || !!newest, mayRequest: !refusal, refusal, current };
}

/**
 * What „Erneut versuchen“ asks again (ST-108): the note and photos of the defect's newest AI assessment, while it is
 * failed. The failed one stays as it is; the photos are shared – they are never deleted (ADR 0009).
 */
export async function aiAssessmentRetryRequest(
  db: Database,
  defectId: string,
): Promise<RequestAiAssessmentInput | undefined> {
  const [newest] = await aiAssessmentsOfDefect(db, defectId);
  if (!newest || newest.state !== "failed") return undefined;
  return { defectId, note: newest.note ?? "", photos: newest.photos };
}

/** The request command's rule as the page asks it: no control that can only be rejected (G11). */
function requestRefusal(
  settings: { aiOn: boolean; chatModel: string | undefined },
  defect: DefectForAiAssessmentRequest | undefined,
  viewer: AiAssessmentViewer | undefined,
  beingWritten: boolean,
): RequestAiAssessmentError | undefined {
  if (!settings.aiOn || !settings.chatModel) return "ai-assessment-ai-off";
  if (!defect || defect.state !== "open") return "ai-assessment-defect-not-open";
  if (!viewer || (viewer.role === "helper" && !defect.suitableForHelpers))
    return "ai-assessment-not-allowed-for-helpers";
  if (beingWritten) return "ai-assessment-being-written";
  return undefined;
}

/**
 * The chat model's name, by its ID – read from OpenRouter once per process and model and then kept. A defect page with
 * an AI assessment otherwise calls OpenRouter on every opening, and while one is being written the page reloads every
 * five seconds; a name that was read once is enough, and a model that cannot be named now falls back to its ID.
 */
const chatModelNames = new Map<string, string>();

async function chatModelName(dependencies: AiDependencies, modelId: string): Promise<string | undefined> {
  const known = chatModelNames.get(modelId);
  if (known) return known;
  const model = await dependencies.ai.model("chat", modelId);
  if (typeof model !== "object") return undefined;
  chatModelNames.set(modelId, model.name);
  return model.name;
}

async function shown(
  db: Database,
  assessment: AiAssessmentState,
  dependencies: AiDependencies,
): Promise<ShownAiAssessment> {
  const [modelName, files] = await Promise.all([
    chatModelName(dependencies, assessment.chatModel),
    filesForAiReferences(
      db,
      (assessment.references ?? []).map((reference) => reference.fileId),
    ),
  ]);
  return {
    id: assessment.id,
    state: assessment.state,
    note: assessment.note,
    photos: assessment.photos,
    requestedBy: assessment.requestedBy,
    requestedAt: assessment.requestedAt,
    chatModel: assessment.chatModel,
    chatModelName: modelName,
    summary: assessment.summary,
    probableCauses: assessment.probableCauses,
    whatToCheckFirst: assessment.whatToCheckFirst,
    references: (assessment.references ?? []).flatMap((reference) => {
      const file = files.get(reference.fileId);
      return file ? [{ ...reference, title: file.title, removed: file.removed }] : [];
    }),
    cost: assessment.cost,
    changedAt: assessment.changedAt,
    failureReason: assessment.failureReason,
  };
}
