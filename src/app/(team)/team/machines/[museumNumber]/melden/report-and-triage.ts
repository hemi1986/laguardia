import { teamReportProblemPhoto } from "./report-problem-input";

/**
 * What the forms that report and triage in the same step share (ST-023, ST-052) – „… und Defekt erfassen“, „… und mit
 * Defekt verknüpfen“, „… und als direkt behoben eintragen“: the problem report's photo. What a rejection says about it
 * (G8a) is the form runner's photo step.
 */

/** The optional photo of the problem report – the same as on the team's report form (ST-016). */
export const reportAndTriagePhoto = teamReportProblemPhoto;
