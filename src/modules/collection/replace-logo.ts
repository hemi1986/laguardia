import type { ActorOf, Decision, DecisionContext } from "@/platform/command";

/**
 * CMD-ReplaceLogo and CMD-RemoveLogo (AGG-MuseumSettings, ST-102): a technician replaces the museum's logo – the first
 * logo is a replacement of none – or removes it. The logo is its own part of the museum settings, with its own version;
 * the image is checked and re-encoded without metadata before the command runs (the photo module's logo acceptance).
 */

/** The ID of the logo part – the one record, inserted without a logo by the migration `museum_logo`. */
export const MUSEUM_LOGO_ID = "7a1e0f40-0000-4000-8000-000000000102";

/** Who may replace or remove the logo – the allowed actors of both commands. */
export const logoActors = ["technician"] as const;

/** The media types a logo may have (invariant: a PNG, JPEG or WebP image). */
export type LogoMediaType = "image/png" | "image/jpeg" | "image/webp";

/** LogoContent (data model): the logo's content in the object store and its media type. */
export type LogoContent = { name: string; contentType: LogoMediaType };

/** The logo part of AGG-MuseumSettings – at most one logo (invariant). */
export type MuseumLogo = { id: string; logo: LogoContent | undefined };

/** The stored logo content the technician replaces the logo with, and the version of the logo they saw (HS-16). */
export type ReplaceLogoInput = { version: number; logo: LogoContent };

/** The version of the logo the technician saw (HS-16). */
export type RemoveLogoInput = { version: number };

export type LogoReplaced = {
  type: "EVT-LogoReplaced";
  museumLogoId: string;
  logo: string;
  contentType: LogoMediaType;
  previousLogo: string | undefined;
  replacedBy: string;
};

export type LogoRemoved = { type: "EVT-LogoRemoved"; museumLogoId: string; removedLogo: string; removedBy: string };

/**
 * There is no logo to remove. Only a page that still showed a logo sends a removal then – someone removed it meanwhile –
 * so its text is the one of a change made meanwhile (ST-102).
 */
export type RemoveLogoError = "no-logo";

type Technician = DecisionContext<ActorOf<(typeof logoActors)[number]>>;

export function replaceLogo(
  stored: MuseumLogo,
  input: ReplaceLogoInput,
  { actor }: Technician,
): Decision<MuseumLogo, LogoReplaced, never> {
  return {
    ok: true,
    state: { ...stored, logo: input.logo },
    events: [
      {
        type: "EVT-LogoReplaced",
        museumLogoId: stored.id,
        logo: input.logo.name,
        contentType: input.logo.contentType,
        previousLogo: stored.logo?.name,
        replacedBy: actor.teamMemberId,
      },
    ],
  };
}

export function removeLogo(
  stored: MuseumLogo,
  _input: RemoveLogoInput,
  { actor }: Technician,
): Decision<MuseumLogo, LogoRemoved, RemoveLogoError> {
  if (!stored.logo) return { ok: false, error: "no-logo" };
  return {
    ok: true,
    state: { ...stored, logo: undefined },
    events: [
      { type: "EVT-LogoRemoved", museumLogoId: stored.id, removedLogo: stored.logo.name, removedBy: actor.teamMemberId },
    ],
  };
}
