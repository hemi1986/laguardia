import { filesForAiReferences } from "@/modules/collection";
import type { Database } from "@/platform/command";
import type { Role } from "@/platform/command";
import {
  requestRefusal,
  type AiAssessmentReference,
  type AiAssessmentState,
  type RequestAiAssessmentError,
  type RequestAiAssessmentInput,
} from "./ai-assessment";
import { aiAssessmentsOfDefect, endedAiAssessmentsOfDefects } from "./ai-assessments";
import type { AiDependencies } from "./ai-settings";
import { requestAiAssessmentFacts } from "./request-ai-assessment-command";

/**
 * RM-DefectAiAssessments (ST-107, ST-111): the section „KI-Einschätzungen“ of a defect's page. It shows the newest AI
 * assessment (being written, otherwise the newest written or failed) open, the earlier ones folded, and whether the team member looking at the page may request
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
  /** The earlier ones, the newest first – each folded (ST-111). */
  earlier: ShownAiAssessment[];
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
  const [facts, all] = await Promise.all([
    requestAiAssessmentFacts(db, defectId, dependencies),
    aiAssessmentsOfDefect(db, defectId),
  ]);
  const refusal = requestRefusal(facts, viewer);
  const [current, ...earlier] = await shownAll(db, all, dependencies);
  return { shown: !refusal || all.length > 0, mayRequest: !refusal, refusal, current, earlier };
}

/**
 * The AI assessments in a machine's repair history (RM-MachineRecord, ST-111): each defect's written and failed ones,
 * the newest first – shown folded under the defect, also while AI is off (G37). A defect without any is not in the map.
 */
export async function aiAssessmentsInRepairHistory(
  db: Database,
  defectIds: string[],
  dependencies: AiDependencies,
): Promise<Map<string, ShownAiAssessment[]>> {
  const byDefect = await endedAiAssessmentsOfDefects(db, defectIds);
  const shownById = new Map(
    (await shownAll(db, [...byDefect.values()].flat(), dependencies)).map((each) => [each.id, each]),
  );
  return new Map(
    [...byDefect].map(([defectId, assessments]) => [
      defectId,
      assessments.map((assessment) => shownById.get(assessment.id)!),
    ]),
  );
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

/** The AI assessments as a page shows them, in the same order – the files' titles read once for all of them. */
async function shownAll(
  db: Database,
  assessments: AiAssessmentState[],
  dependencies: AiDependencies,
): Promise<ShownAiAssessment[]> {
  if (assessments.length === 0) return [];
  const models = [...new Set(assessments.map((assessment) => assessment.chatModel))];
  const [modelNames, files] = await Promise.all([
    Promise.all(models.map((model) => chatModelName(dependencies, model))),
    filesForAiReferences(
      db,
      assessments.flatMap((assessment) => (assessment.references ?? []).map((reference) => reference.fileId)),
    ),
  ]);
  const names = new Map(models.map((model, index) => [model, modelNames[index]]));
  return assessments.map((assessment) => shown(assessment, names.get(assessment.chatModel), files));
}

function shown(
  assessment: AiAssessmentState,
  modelName: string | undefined,
  files: Awaited<ReturnType<typeof filesForAiReferences>>,
): ShownAiAssessment {
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
