import type { ShownAiAssessment } from "@/modules/ai-assistance";
import type { Named } from "./named";
import { photoAt } from "./team-photos";

/**
 * An AI assessment as a team page shows it (ST-107, ST-111) – its requester by name, its photos at their short-lived
 * addresses (those no address could be issued for are left out).
 */
export type ShownAiAssessmentData = Omit<ShownAiAssessment, "photos"> & {
  requestedByName: string;
  photos: { address: string }[];
};

/** AI assistance's AI assessment with Team's name and the photo module's addresses – the page composes (ST-009). */
export function shownAiAssessmentData(
  assessment: ShownAiAssessment,
  shown: Pick<Named, "name">,
  photos: Map<string, string>,
): ShownAiAssessmentData {
  return {
    ...assessment,
    requestedByName: shown.name(assessment.requestedBy),
    photos: assessment.photos.flatMap((photo) => photoAt(photos, photo) ?? []),
  };
}
