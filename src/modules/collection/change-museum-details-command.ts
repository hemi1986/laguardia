import { aggregateCommand } from "@/platform/command";
import { changeMuseumDetails, museumDetailsActors, MUSEUM_DETAILS_ID } from "./change-museum-details";
import { collectionEvents } from "./events";
import { museumDetailsStore } from "./museum-settings";

/**
 * CMD-ChangeMuseumDetails through the command layer (ST-100): a change of the museum details at the version the
 * technician saw – the version check of this part only –, emits EVT-MuseumDetailsChanged. Saving without a change
 * records no event and is no rejection (HS-27).
 */
export const changeMuseumDetailsCommand = aggregateCommand({
  id: "CMD-ChangeMuseumDetails",
  allowedActors: museumDetailsActors,
  store: museumDetailsStore,
  target: (input) => ({ id: MUSEUM_DETAILS_ID, version: input.version }),
  mayChangeNothing: true,
  decide: changeMuseumDetails,
  journal: collectionEvents.journal,
  result: () => ({}),
});
