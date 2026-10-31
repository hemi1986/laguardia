import { aggregateCommand } from "@/platform/command";
import { collectionEvents } from "./events";
import { museumLogoStore } from "./museum-settings";
import { logoActors, MUSEUM_LOGO_ID, removeLogo, replaceLogo } from "./replace-logo";

/**
 * CMD-ReplaceLogo through the command layer (ST-102): the logo replaced at the version the technician saw – the version
 * check of the logo part only –, emits EVT-LogoReplaced. The previous logo's content is deleted after the commit by the
 * runner (deliberate removal, ADR 0009).
 */
export const replaceLogoCommand = aggregateCommand({
  id: "CMD-ReplaceLogo",
  allowedActors: logoActors,
  store: museumLogoStore,
  target: (input) => ({ id: MUSEUM_LOGO_ID, version: input.version }),
  decide: replaceLogo,
  journal: collectionEvents.journal,
  result: (_logo, [replaced]) => ({ previousLogo: replaced?.previousLogo }),
  removesContent: ({ previousLogo }) => previousLogo,
});

/**
 * CMD-RemoveLogo through the command layer (ST-102): the logo removed at the version the technician saw, one tap, no
 * question first (G10c); emits EVT-LogoRemoved. The removed logo's content is deleted after the commit by the runner.
 */
export const removeLogoCommand = aggregateCommand({
  id: "CMD-RemoveLogo",
  allowedActors: logoActors,
  store: museumLogoStore,
  target: (input) => ({ id: MUSEUM_LOGO_ID, version: input.version }),
  decide: removeLogo,
  journal: collectionEvents.journal,
  result: (_logo, [removed]) => ({ removedLogo: removed.removedLogo }),
  removesContent: ({ removedLogo }) => removedLogo,
});
