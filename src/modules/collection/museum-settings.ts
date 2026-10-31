import { eq } from "drizzle-orm";
import type { VisitorLocale } from "@/platform/messages";
import { aggregateStore, entriesOf, lastCommandBy, type Database, type TeamMemberId } from "@/platform/command";
import { LEGAL_TEXTS_ID, type LegalTexts } from "./change-legal-texts";
import { MUSEUM_DETAILS_ID, type MuseumDetails } from "./change-museum-details";
import { collectionEvents } from "./events";
import { MUSEUM_LOGO_ID, type LogoMediaType, type MuseumLogo } from "./replace-logo";
import {
  legalTexts as legalTextsTable,
  museumDetails as museumDetailsTable,
  museumLogo as museumLogoTable,
} from "./schema";

/**
 * How the museum details part of AGG-MuseumSettings is stored (ST-100): its one row, versioned on its own (HS-16) – the
 * logo and the legal texts get records of their own the same way (ST-102, ST-103).
 */
export const museumDetailsStore = aggregateStore({
  type: "AGG-MuseumSettings",
  table: museumDetailsTable,
  toState: (row): MuseumDetails => ({
    id: row.id,
    museumName: row.museumName,
    machinesListed: row.machinesListed,
  }),
  toRow: (details: MuseumDetails) => details,
});

/**
 * How the logo part of AGG-MuseumSettings is stored (ST-102): its one row, versioned on its own (HS-16) – a reference to
 * the content and its media type, both null while there is no logo.
 */
export const museumLogoStore = aggregateStore({
  type: "AGG-MuseumSettings",
  table: museumLogoTable,
  toState: (row): MuseumLogo => ({
    id: row.id,
    logo: row.content ? { name: row.content, contentType: row.contentType as LogoMediaType } : undefined,
  }),
  toRow: ({ id, logo }: MuseumLogo) => ({ id, content: logo?.name ?? null, contentType: logo?.contentType ?? null }),
});

function legalTextsOf(row: typeof legalTextsTable.$inferSelect): LegalTexts {
  return {
    id: row.id,
    privacyNotice: { de: row.privacyNoticeDe, en: row.privacyNoticeEn ?? undefined },
    imprint: row.imprintDe ? { de: row.imprintDe, en: row.imprintEn ?? undefined } : undefined,
  };
}

/**
 * How the legal texts part of AGG-MuseumSettings is stored (ST-103): its one row, versioned on its own (HS-16) – a text
 * that is not provided is null; an imprint is there when its German text is (invariant, HS-25).
 */
export const legalTextsStore = aggregateStore({
  type: "AGG-MuseumSettings",
  table: legalTextsTable,
  toState: (row) => legalTextsOf(row),
  toRow: ({ id, privacyNotice, imprint }: LegalTexts) => ({
    id,
    privacyNoticeDe: privacyNotice.de,
    privacyNoticeEn: privacyNotice.en ?? null,
    imprintDe: imprint?.de ?? null,
    imprintEn: imprint?.en ?? null,
  }),
});

/** RM-MuseumSettings (ST-100, ST-102, ST-103): what the museum settings page shows – its three forms with their versions. */
export type MuseumSettings = {
  museumName: string;
  machinesListed: boolean;
  /** The version of the museum details the form „Museum“ posts (HS-16). */
  museumDetailsVersion: number;
  /** The logo's content name – for the team page's view address only, never for a visitor page (HS-1 exception, ST-102). */
  logo: string | undefined;
  /** The version of the logo the form „Logo“ posts (HS-16). */
  logoVersion: number;
  /** The legal texts as Markdown, as typed (ST-103) – an empty string for one that is not provided. */
  legalTexts: { privacyNoticeDe: string; privacyNoticeEn: string; imprintDe: string; imprintEn: string };
  /** The version of the legal texts the form „Rechtstexte“ posts (HS-16). */
  legalTextsVersion: number;
  /** Whether visitor pages offer an imprint – a German one is provided (RM-WelcomePage, RM-LegalPage). */
  imprintProvided: boolean;
};

async function storedDetails(db: Database) {
  const [row] = await db.select().from(museumDetailsTable).where(eq(museumDetailsTable.id, MUSEUM_DETAILS_ID));
  // The migration inserts the one record; without it the database is not migrated.
  if (!row) throw new Error("The museum details are missing – is the database migrated?");
  return row;
}

async function storedLogo(db: Database) {
  const [row] = await db.select().from(museumLogoTable).where(eq(museumLogoTable.id, MUSEUM_LOGO_ID));
  // The migration inserts the one record; without it the database is not migrated.
  if (!row) throw new Error("The museum logo is missing – is the database migrated?");
  return row;
}

async function storedLegalTexts(db: Database) {
  const [row] = await db.select().from(legalTextsTable).where(eq(legalTextsTable.id, LEGAL_TEXTS_ID));
  // The migration inserts the one record; without it the database is not migrated.
  if (!row) throw new Error("The legal texts are missing – is the database migrated?");
  return row;
}

/** RM-MuseumSettings (ST-100, ST-102, ST-103): the museum settings as the technician's page shows them. */
export async function museumSettings(db: Database): Promise<MuseumSettings> {
  const [details, logo, legal] = await Promise.all([storedDetails(db), storedLogo(db), storedLegalTexts(db)]);
  return {
    museumName: details.museumName,
    machinesListed: details.machinesListed,
    museumDetailsVersion: details.version,
    logo: logo.content ?? undefined,
    logoVersion: logo.version,
    legalTexts: {
      privacyNoticeDe: legal.privacyNoticeDe,
      privacyNoticeEn: legal.privacyNoticeEn ?? "",
      imprintDe: legal.imprintDe ?? "",
      imprintEn: legal.imprintEn ?? "",
    },
    legalTextsVersion: legal.version,
    imprintProvided: legal.imprintDe !== null,
  };
}

/** Which legal text a visitor legal page shows (ST-064, ST-103): `/datenschutz` or `/impressum`. */
export type LegalTextKind = "privacy-notice" | "imprint";

/**
 * RM-LegalPage (ST-103): a legal text in the visitor's language as Markdown – the German text where no English one is
 * provided –, and whether the imprint is offered. Undefined for an imprint the museum does not provide: then
 * `/impressum` is not found (ST-064).
 */
export async function legalPage(
  db: Database,
  kind: LegalTextKind,
  locale: VisitorLocale,
): Promise<{ markdown: string; imprintProvided: boolean } | undefined> {
  const { privacyNotice, imprint } = legalTextsOf(await storedLegalTexts(db));
  const text = kind === "privacy-notice" ? privacyNotice : imprint;
  if (!text) return undefined;
  return { markdown: (locale === "en" && text.en) || text.de, imprintProvided: !!imprint };
}

/** Whether the museum provides an imprint (ST-103) – every visitor page offers it then, in German and English (HS-25). */
export async function imprintProvided(db: Database): Promise<boolean> {
  return (await storedLegalTexts(db)).imprintDe !== null;
}

/**
 * The logo's content name for the public address `/logo` (ST-102) – the one place outside a team page that issues a view
 * address (HS-1 exception: the logo is public by nature). Undefined without a logo.
 */
export async function museumLogo(db: Database): Promise<string | undefined> {
  return (await storedLogo(db)).content ?? undefined;
}

/** The museum's name – the one every visitor page that names the museum shows (ST-100), in every language. */
export async function museumName(db: Database): Promise<string> {
  return (await storedDetails(db)).museumName;
}

/**
 * What the team member's latest change of the logo was (ST-102), for the confirmation on the museum settings page (G3) –
 * only when the latest command on the logo is theirs. The logo's ID stays inside Collection, like the maintenance plan's.
 */
export async function logoChangedBy(db: Database, teamMemberId: TeamMemberId): Promise<"replaced" | "removed" | undefined> {
  const command = await lastCommandBy(db, { aggregateId: MUSEUM_LOGO_ID }, teamMemberId);
  const entries = command ? entriesOf(collectionEvents, command) : [];
  if (entries.some((entry) => entry.type === "EVT-LogoReplaced")) return "replaced";
  if (entries.some((entry) => entry.type === "EVT-LogoRemoved")) return "removed";
  return undefined;
}
