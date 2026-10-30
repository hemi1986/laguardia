"use client";

import { type ComponentProps } from "react";
import { GroupedChoice } from "@/components/ui/grouped-choice";
import { teamMessages } from "@/platform/messages";

const { groupedChoice } = teamMessages;

/**
 * `GroupedChoice` with the team's texts (G27, architecture review 2026-10-30): the header „Flipper · EM – 4 von 6
 * ausgewählt“ and „Alle auswählen“ – the component itself carries no texts. Every team form that chooses many out of a
 * long list uses this one.
 */
export function TeamGroupedChoice(props: Omit<ComponentProps<typeof GroupedChoice>, "header" | "selectAll">) {
  return <GroupedChoice {...props} header={groupedChoice.header} selectAll={groupedChoice.selectAll} />;
}
