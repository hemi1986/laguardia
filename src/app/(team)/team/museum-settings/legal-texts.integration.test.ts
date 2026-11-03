import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { formRunner } from "@/app/_actions/form-runner";
import { LegalPage } from "@/app/legal-page";
import { WelcomePageView } from "@/app/welcome-page";
import {
  changeLegalTextsCommand,
  changeMuseumDetailsCommand,
  legalPage,
  museumSettings,
  welcomePage,
  type LegalTextKind,
} from "@/modules/collection";
import {
  legalTextsJournal,
  withDefaultLegalTexts,
  withDefaultMuseumDetails,
} from "@/modules/collection/museum-settings.test-support";
import { fixedClock } from "@/platform/clock";
import type { Actor } from "@/platform/command";
import { visitorMessages, type VisitorLocale } from "@/platform/messages";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { post } from "@/test-support/forms";
import { anExistingTeamMember } from "@/test-support/team-members";
import { legalTextsFormDefinition } from "./legal-texts-form-input";
import { LegalTextsFormContent } from "./legal-texts-form";
import { museumFormDefinition } from "./museum-form-input";
import { loadMuseumSettings, savedLanding } from "./museum-settings-data";
import { MuseumSettingsView } from "./museum-settings";

/**
 * The form „Rechtstexte“ of the museum settings (ST-103) and what visitors read of it: the form's fields and input
 * function run through the Server Action runner as the signed-in team member; the settings page, the legal pages
 * (RM-LegalPage) and the welcome page's legal links are rendered from what is stored. In a database of its own: the
 * legal texts exist once, and every test starts from their defaults.
 */
const isolated = isolatedTestDatabase("legal_texts_page");
let db: NodePgDatabase;
const clock = fixedClock("2026-10-31T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, eva, "Eva");
});

afterAll(() => isolated.close());

beforeEach(async () => {
  await withDefaultLegalTexts(db);
  await withDefaultMuseumDetails(db);
});

type LegalTextsChange = Partial<Record<"privacyNoticeDe" | "privacyNoticeEn" | "imprintDe" | "imprintEn", string>>;

/** The form „Rechtstexte“ as the actor sends it; `landed` counts the saves that landed back on the page. */
function legalTextsFormOf(actor: Actor) {
  const landed: string[] = [];
  const action = formRunner({ currentPerson: async () => actor, db, clock, newId: randomUUID })(
    changeLegalTextsCommand,
    { ...legalTextsFormDefinition, onSuccess: async () => void landed.push("saved") },
  );
  return { action, landed };
}

/** The form as the page shows it now, changed as given – the browser sends a text area's line breaks as CRLF. */
async function filledIn(change: LegalTextsChange, version?: number) {
  const { legalTexts, legalTextsVersion } = await museumSettings(db);
  const typed = { ...legalTexts, ...change };
  const asSent = (text: string) => text.replace(/\n/g, "\r\n");
  return post({
    version: String(version ?? legalTextsVersion),
    privacyNoticeDe: asSent(typed.privacyNoticeDe),
    privacyNoticeEn: asSent(typed.privacyNoticeEn),
    imprintDe: asSent(typed.imprintDe),
    imprintEn: asSent(typed.imprintEn),
  });
}

/** Saves the legal texts as a technician does, and expects the save to land on the page. */
async function saved(change: LegalTextsChange, actor: Actor = tom) {
  const { action, landed } = legalTextsFormOf(actor);
  expect(await action(null, await filledIn(change))).toBeNull();
  expect(landed).toEqual(["saved"]);
}

/** A legal page as a visitor with that browser language is shown it – undefined where the page is not found. */
async function visitorLegalPage(kind: LegalTextKind, locale: VisitorLocale) {
  const page = await legalPage(db, kind, locale);
  if (!page) return undefined;
  const messages = visitorMessages(locale);
  const title = kind === "privacy-notice" ? messages.legal.privacyNoticeTitle : messages.legal.imprintTitle;
  return renderToStaticMarkup(createElement(LegalPage, { title, ...page, locale, messages, path: "/" }));
}

/** The welcome page as a visitor with that browser language is shown it – a visitor page like any other. */
async function visitorWelcomePage(locale: VisitorLocale) {
  const page = await welcomePage(db, locale);
  return renderToStaticMarkup(createElement(WelcomePageView, { ...page, locale, messages: visitorMessages(locale) }));
}

/** The museum's text on a legal page – without the page's frame. */
const shownText = (html: string | undefined) => html?.match(/<div data-slot="legal-text"[^>]*>([\s\S]*?)<\/div>/)?.[1];

/** The settings page the technician lands on. */
async function settingsPage(address = "/team/museum-settings") {
  const params = Object.fromEntries(new URL(address, "http://localhost").searchParams);
  return renderToStaticMarkup(createElement(MuseumSettingsView, await loadMuseumSettings(db, params)));
}

/** The form „Rechtstexte“ after a rejection: the page's version and texts, and what the action state kept. */
async function formAfter(state: Awaited<ReturnType<ReturnType<typeof legalTextsFormOf>["action"]>>) {
  const { legalTexts, legalTextsVersion } = await museumSettings(db);
  return renderToStaticMarkup(
    createElement(LegalTextsFormContent, { version: legalTextsVersion, texts: legalTexts, state }),
  );
}

/** A text area of the form, with its content as the page shows it. */
const textArea = (html: string, name: string) =>
  html.match(new RegExp(`<textarea[^>]*name="${name}"[^>]*>([\\s\\S]*?)</textarea>`)) ?? undefined;
const escaped = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");

const imprintLink = /href="\/impressum"/;

it("ST-103: Visitors read the privacy notice the technician wrote, in their language", async () => {
  await saved({
    privacyNoticeDe:
      "# Wer wir sind\n\nDas Museum ist **verantwortlich**.\n\n- Meldungen\n- Fotos\n\n[Kontakt](https://flippermuseum-eschbach.de/kontakt)",
    privacyNoticeEn: "# Who we are\n\nThe museum is responsible.",
  });

  const german = await visitorLegalPage("privacy-notice", "de");
  expect(german).toMatch(/<h1[^>]*>Datenschutzhinweis<\/h1>/);
  expect(shownText(german)).toBe(
    "<h2>Wer wir sind</h2>\n<p>Das Museum ist <strong>verantwortlich</strong>.</p>\n<ul>\n<li>Meldungen</li>\n<li>Fotos</li>\n</ul>\n" +
      '<p><a href="https://flippermuseum-eschbach.de/kontakt">Kontakt</a></p>\n',
  );
  const english = await visitorLegalPage("privacy-notice", "en");
  expect(english).toMatch(/<h1[^>]*>Privacy notice<\/h1>/);
  expect(shownText(english)).toBe("<h2>Who we are</h2>\n<p>The museum is responsible.</p>\n");
  // The journal names which texts changed and who changed them – the texts themselves stay out of it.
  const [changed] = (await legalTextsJournal(db)).slice(-1);
  expect(changed).toMatchObject({
    type: "EVT-LegalTextsChanged",
    actor: tom,
    data: { changedTexts: ["privacy-notice-de", "privacy-notice-en"] },
  });
  expect(JSON.stringify(changed.data)).not.toMatch(/Museum|museum/);
});

it("ST-103: An imprint in German only is offered in both languages", async () => {
  await saved({ imprintDe: "# Anbieter\n\nFlipper- & Arcade Museum Eschbach e. V." });

  expect(await visitorWelcomePage("en")).toMatch(imprintLink);
  const english = await visitorLegalPage("imprint", "en");
  expect(english).toMatch(/<h1[^>]*>Imprint<\/h1>/);
  expect(shownText(english)).toBe("<h2>Anbieter</h2>\n<p>Flipper- &amp; Arcade Museum Eschbach e. V.</p>\n");
  // Every visitor page offers it – the legal page itself too.
  expect(english).toMatch(imprintLink);
  expect(await visitorWelcomePage("de")).toMatch(imprintLink);
});

it("ST-103: Without an imprint none is offered", async () => {
  await saved({ imprintDe: "Impressum", imprintEn: "Imprint" });
  expect(await visitorWelcomePage("de")).toMatch(imprintLink);

  await saved({ imprintDe: "", imprintEn: "\n" });

  for (const locale of ["de", "en"] as const) {
    expect(await visitorWelcomePage(locale)).not.toMatch(imprintLink);
    expect(await visitorLegalPage("privacy-notice", locale)).not.toMatch(imprintLink);
    // `/impressum` has nothing to show and is not found (its page calls notFound()).
    expect(await visitorLegalPage("imprint", locale)).toBeUndefined();
  }
  expect((await legalTextsJournal(db)).at(-1)).toMatchObject({ data: { changedTexts: ["imprint-de", "imprint-en"] } });
});

it("ST-103: Before any change the placeholder privacy notice is shown", async () => {
  const html = await settingsPage();

  expect(html).toMatch(/<h2[^>]*>Rechtstexte<\/h2>/);
  // The last section of the page.
  expect(html.lastIndexOf("<h2")).toBe(html.search(/<h2[^>]*>Rechtstexte<\/h2>/));
  expect(textArea(html, "privacyNoticeDe")?.[1]).toContain("PLATZHALTER");
  expect(textArea(html, "privacyNoticeEn")?.[1]).toContain("PLACEHOLDER");
  expect(textArea(html, "imprintDe")?.[1]).toBe("");
  expect(textArea(html, "imprintEn")?.[1]).toBe("");
  expect(html).toContain("Datenschutzhinweis (Deutsch)");
  expect(html).toContain("Impressum (Englisch, freiwillig)");
  expect(html).toContain("Alles andere erscheint als einfacher Text.");
  expect(html).not.toContain("Rechtstexte gespeichert.");

  expect(shownText(await visitorLegalPage("privacy-notice", "de"))).toContain("PLATZHALTER");
  expect(shownText(await visitorLegalPage("privacy-notice", "en"))).toContain("PLACEHOLDER");
  expect(shownText(await visitorLegalPage("privacy-notice", "de"))).toContain("<h2>Meldungen</h2>");
  expect(await visitorLegalPage("imprint", "de")).toBeUndefined();
  expect(await visitorWelcomePage("de")).not.toMatch(imprintLink);
});

it("ST-103: An emptied German privacy notice is rejected", async () => {
  const before = await museumSettings(db);
  const { action, landed } = legalTextsFormOf(tom);

  const state = await action(null, await filledIn({ privacyNoticeDe: " \n ", imprintDe: "# Anbieter" }));

  expect(state).toMatchObject({ error: "privacy-notice-required" });
  expect(landed).toEqual([]);
  const form = await formAfter(state);
  const field = textArea(form, "privacyNoticeDe")!;
  expect(field[0]).toContain('aria-invalid="true"');
  // The reason stands at the German privacy notice, before the next field.
  const reason = form.indexOf("Bitte einen Datenschutzhinweis angeben.");
  expect(reason).toBeGreaterThan(form.indexOf(field[0]));
  expect(reason).toBeLessThan(form.indexOf('name="privacyNoticeEn"'));
  expect(textArea(form, "imprintDe")?.[1]).toBe("# Anbieter");
  // Kept as the browser sent it.
  expect(textArea(form, "privacyNoticeEn")?.[1].replaceAll("\r\n", "\n")).toBe(
    escaped(before.legalTexts.privacyNoticeEn),
  );
  expect(await museumSettings(db)).toEqual(before);
});

it("ST-103: An English imprint without a German one is rejected", async () => {
  const before = await museumSettings(db);
  const { action, landed } = legalTextsFormOf(tom);

  const state = await action(null, await filledIn({ imprintEn: "# Provider" }));

  expect(state).toMatchObject({ error: "english-imprint-needs-german-imprint" });
  expect(landed).toEqual([]);
  const form = await formAfter(state);
  const field = textArea(form, "imprintEn")!;
  expect(field[0]).toContain('aria-invalid="true"');
  const reason = form.indexOf(
    "Ein englisches Impressum geht nur zusammen mit einem deutschen. Bitte auch das deutsche Impressum angeben.",
  );
  expect(reason).toBeGreaterThan(form.indexOf(field[0]));
  expect(field[1]).toBe("# Provider");
  expect(await museumSettings(db)).toEqual(before);
  for (const locale of ["de", "en"] as const) expect(await visitorWelcomePage(locale)).not.toMatch(imprintLink);
  expect(await visitorLegalPage("imprint", "en")).toBeUndefined();
});

it("ST-103: Markdown outside the shown elements reaches visitors as plain text", async () => {
  const typed = [
    "<script>alert(1)</script>",
    "",
    "![Bild](x.png)",
    "",
    "| Zweck | Dauer |",
    "| --- | --- |",
    "| Meldung | 1 Jahr |",
    "",
    "[Klick](javascript:alert(1))",
    "",
    "[Kontakt](https://flippermuseum-eschbach.de/kontakt) und [Mail](mailto:info@example.org)",
  ].join("\n");

  await saved({ privacyNoticeDe: typed });

  expect((await museumSettings(db)).legalTexts.privacyNoticeDe).toBe(typed);
  expect(textArea(await settingsPage(savedLanding("legal-texts")), "privacyNoticeDe")?.[1]).toBe(escaped(typed));
  const shown = shownText(await visitorLegalPage("privacy-notice", "de"))!;
  for (const source of [
    "<script>alert(1)</script>",
    "![Bild](x.png)",
    "| Zweck | Dauer |",
    "[Klick](javascript:alert(1))",
  ]) {
    expect(shown).toContain(escaped(source).replaceAll("&quot;", '"'));
  }
  expect(shown).not.toMatch(/<(script|img|table)\b/);
  const addresses = [...shown.matchAll(/<a [^>]*href="([^"]*)"/g)].map(([, address]) => address);
  expect(addresses).toEqual(["https://flippermuseum-eschbach.de/kontakt", "mailto:info@example.org"]);
});

it("ST-103: Legal texts changed by someone else meanwhile are not overwritten", async () => {
  const opened = (await museumSettings(db)).legalTextsVersion;
  await saved({ privacyNoticeDe: "# Evas Datenschutzhinweis" }, eva);

  const state = await legalTextsFormOf(tom).action(null, await filledIn({ imprintDe: "# Toms Impressum" }, opened));

  expect(state).toMatchObject({ error: "version-conflict" });
  const form = await formAfter(state);
  expect(form).toContain("Jemand hat das inzwischen geändert. Deine Eingabe ist noch da – bitte noch einmal senden.");
  expect(textArea(form, "imprintDe")?.[1]).toBe("# Toms Impressum");
  expect((await museumSettings(db)).legalTexts).toMatchObject({
    privacyNoticeDe: "# Evas Datenschutzhinweis",
    imprintDe: "",
  });
});

it("ST-103: A change to another part meanwhile does not reject the legal texts", async () => {
  const opened = await museumSettings(db);
  const museumForm = formRunner({ currentPerson: async () => eva, db, clock, newId: randomUUID })(
    changeMuseumDetailsCommand,
    { ...museumFormDefinition, onSuccess: async () => {} },
  );
  expect(
    await museumForm(
      null,
      post({ version: String(opened.museumDetailsVersion), museumName: "Flippermuseum Eschbach" }),
    ),
  ).toBeNull();

  const { action, landed } = legalTextsFormOf(tom);
  expect(
    await action(null, await filledIn({ privacyNoticeDe: "# Toms Datenschutzhinweis" }, opened.legalTextsVersion)),
  ).toBeNull();

  expect(landed).toEqual(["saved"]);
  const now = await museumSettings(db);
  expect(now.legalTexts.privacyNoticeDe).toBe("# Toms Datenschutzhinweis");
  expect(now.museumName).toBe("Flippermuseum Eschbach");
  expect(await settingsPage(savedLanding("legal-texts"))).toContain("Rechtstexte gespeichert.");
});

it("saves the form as the page showed it without recording anything (HS-27)", async () => {
  const before = await museumSettings(db);
  const journalBefore = await legalTextsJournal(db);

  await saved({});

  expect(await museumSettings(db)).toEqual(before);
  expect(await legalTextsJournal(db)).toEqual(journalBefore);
});

it("refuses a helper's legal texts and changes nothing (G11)", async () => {
  const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
  await anExistingTeamMember(db, anna, "Anna");
  const before = await museumSettings(db);

  const state = await legalTextsFormOf(anna).action(null, await filledIn({ imprintDe: "Annas Impressum" }));

  expect(state).toMatchObject({ error: "not-authorized" });
  expect(await museumSettings(db)).toEqual(before);
});
