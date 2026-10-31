import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { changeLegalTexts, type ChangeLegalTextsInput, type LegalTexts } from "./change-legal-texts";

/**
 * CMD-ChangeLegalTexts' decision (ST-103): which texts a save changes, what counts as empty, the invariants of the legal
 * texts (HS-25) and a save without a change (HS-27).
 */
const stored: LegalTexts = {
  id: "legal-texts",
  privacyNotice: { de: "# Datenschutz\n\nText", en: "# Privacy\n\nText" },
  imprint: undefined,
};
const technician = { kind: "team-member", teamMemberId: "tom", role: "technician" } as const;
const context = { actor: technician, clock: fixedClock("2026-10-31T10:00:00Z"), newId: () => "id" };
const unchanged: Omit<ChangeLegalTextsInput, "version"> = {
  privacyNoticeDe: stored.privacyNotice.de,
  privacyNoticeEn: stored.privacyNotice.en ?? "",
  imprintDe: "",
  imprintEn: "",
};
const save = (change: Partial<ChangeLegalTextsInput>, from: LegalTexts = stored) =>
  changeLegalTexts(from, { version: 0, ...unchanged, ...change }, context);

describe("changing the legal texts", () => {
  it.each([
    ["a new German privacy notice", { privacyNoticeDe: "Neu" }, ["privacy-notice-de"]],
    ["the English privacy notice emptied", { privacyNoticeEn: "" }, ["privacy-notice-en"]],
    ["a German imprint", { imprintDe: "# Impressum" }, ["imprint-de"]],
    ["a German and an English imprint", { imprintDe: "Impressum", imprintEn: "Imprint" }, ["imprint-de", "imprint-en"]],
  ] as const)("names what changed: %s", (_case, change, changedTexts) => {
    const decision = save(change);

    expect(decision).toMatchObject({
      ok: true,
      events: [{ type: "EVT-LegalTextsChanged", changedTexts, changedBy: "tom" }],
    });
  });

  it("keeps a text as typed, its line breaks as LF, and leaves an empty one not provided", () => {
    const decision = save({
      privacyNoticeDe: "  # Datenschutz\r\n\r\nZeile  \r\nweiter\n",
      privacyNoticeEn: " \r\n ",
      imprintDe: "Impressum",
    });

    expect(decision).toMatchObject({
      ok: true,
      state: {
        privacyNotice: { de: "  # Datenschutz\n\nZeile  \nweiter\n", en: undefined },
        imprint: { de: "Impressum", en: undefined },
      },
    });
  });

  it.each([
    ["the same texts", {}],
    ["the same texts with the browser's line breaks", { privacyNoticeDe: "# Datenschutz\r\n\r\nText" }],
    ["an imprint of only spaces where there is none", { imprintDe: "   ", imprintEn: "\n" }],
  ] as const)("records nothing for a save without a change (HS-27): %s", (_case, change) => {
    expect(save(change)).toEqual({ ok: true, state: stored, events: [] });
  });

  it.each([
    ["emptied", ""],
    ["only spaces and line breaks", " \r\n \n"],
  ])("rejects a German privacy notice %s", (_case, privacyNoticeDe) => {
    expect(save({ privacyNoticeDe, imprintDe: "Impressum" })).toEqual({ ok: false, error: "privacy-notice-required" });
  });

  it.each([
    ["only an English imprint", { imprintEn: "Imprint" }],
    ["the German imprint emptied beside an English one", { imprintDe: " ", imprintEn: "Imprint" }],
  ] as const)("rejects an English imprint without a German one (HS-25): %s", (_case, change) => {
    const withImprint: LegalTexts = { ...stored, imprint: { de: "Impressum", en: "Imprint" } };

    expect(save(change, withImprint)).toEqual({ ok: false, error: "english-imprint-needs-german-imprint" });
  });

  it("removes the imprint when both are emptied", () => {
    const withImprint: LegalTexts = { ...stored, imprint: { de: "Impressum", en: "Imprint" } };

    expect(save({}, withImprint)).toMatchObject({
      ok: true,
      state: { imprint: undefined },
      events: [{ changedTexts: ["imprint-de", "imprint-en"] }],
    });
  });
});
