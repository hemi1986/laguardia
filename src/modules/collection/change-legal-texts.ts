import type { ActorOf, Decision, DecisionContext } from "@/platform/command";

/**
 * CMD-ChangeLegalTexts (AGG-MuseumSettings, ST-103): a technician changes the legal texts – the privacy notice and the
 * imprint, each in German and English – in the form „Rechtstexte“. The legal texts are their own part of the museum
 * settings, with their own version; the texts are Markdown, saved as typed (ADR 0013 – what visitors see of them is the
 * renderer's business, never a reason to reject a save).
 */

/** The ID of the legal texts part – the one record, inserted with the defaults by the migration `legal_texts`. */
export const LEGAL_TEXTS_ID = "7a1e0f40-0000-4000-8000-000000000103";

/** Who may change the legal texts – the allowed actors of CMD-ChangeLegalTexts. */
export const legalTextsActors = ["technician"] as const;

/** A legal text in German and, if provided, in English – visitors read the German one where no English one is provided. */
export type LegalTextInLanguages = { de: string; en: string | undefined };

/**
 * The legal texts part of AGG-MuseumSettings. Invariants: the German privacy notice is never empty, every other legal text
 * is either not provided or not empty, and an English imprint is provided only together with a German one (HS-25) – so an
 * imprint, when there is one, always has its German text.
 */
export type LegalTexts = {
  id: string;
  privacyNotice: LegalTextInLanguages;
  imprint: LegalTextInLanguages | undefined;
};

/** The four texts of the form as typed (ST-073, Q19) – an empty one is not provided. */
export type ChangeLegalTextsInput = {
  /** The version of the legal texts the technician saw (HS-16). */
  version: number;
  privacyNoticeDe: string;
  privacyNoticeEn: string;
  imprintDe: string;
  imprintEn: string;
};

/** Which of the four legal texts a change touched – the journal names them instead of the texts. */
export type LegalTextKey = "privacy-notice-de" | "privacy-notice-en" | "imprint-de" | "imprint-en";

export type LegalTextsChanged = {
  type: "EVT-LegalTextsChanged";
  legalTextsId: string;
  changedTexts: LegalTextKey[];
  privacyNotice: LegalTextInLanguages;
  imprint: LegalTextInLanguages | undefined;
  changedBy: string;
};

export type ChangeLegalTextsError = "privacy-notice-required" | "english-imprint-needs-german-imprint";

/**
 * A text as the form sent it: the browser's line breaks (`CRLF`) taken as `LF`, so a form nobody edited is no change; one
 * of only spaces or line breaks is not provided (as for the museum name, ST-100). Otherwise kept as typed – in Markdown
 * even trailing spaces mean something.
 */
function provided(typed: string): string | undefined {
  const text = typed.replace(/\r\n?/g, "\n");
  return text.trim() ? text : undefined;
}

type Technician = DecisionContext<ActorOf<(typeof legalTextsActors)[number]>>;

export function changeLegalTexts(
  stored: LegalTexts,
  input: ChangeLegalTextsInput,
  { actor }: Technician,
): Decision<LegalTexts, LegalTextsChanged, ChangeLegalTextsError> {
  const privacyNoticeDe = provided(input.privacyNoticeDe);
  if (!privacyNoticeDe) return { ok: false, error: "privacy-notice-required" };
  const imprintDe = provided(input.imprintDe);
  const imprintEn = provided(input.imprintEn);
  if (imprintEn && !imprintDe) return { ok: false, error: "english-imprint-needs-german-imprint" };

  const privacyNotice = { de: privacyNoticeDe, en: provided(input.privacyNoticeEn) };
  const imprint = imprintDe ? { de: imprintDe, en: imprintEn } : undefined;
  const changedTexts: LegalTextKey[] = (
    [
      ["privacy-notice-de", privacyNotice.de, stored.privacyNotice.de],
      ["privacy-notice-en", privacyNotice.en, stored.privacyNotice.en],
      ["imprint-de", imprint?.de, stored.imprint?.de],
      ["imprint-en", imprint?.en, stored.imprint?.en],
    ] as const
  )
    .filter(([, typed, before]) => typed !== before)
    .map(([key]) => key);
  // Saving without a change records nothing and is no rejection (HS-27).
  if (changedTexts.length === 0) return { ok: true, state: stored, events: [] };
  return {
    ok: true,
    state: { ...stored, privacyNotice, imprint },
    events: [
      {
        type: "EVT-LegalTextsChanged",
        legalTextsId: stored.id,
        changedTexts,
        privacyNotice,
        imprint,
        changedBy: actor.teamMemberId,
      },
    ],
  };
}
