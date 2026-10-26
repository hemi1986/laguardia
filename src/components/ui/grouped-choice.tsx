"use client";

import { useState, useSyncExternalStore } from "react";

/** One group of the choice: a name for the header and its entries (checkboxes). */
export type ChoiceGroup = {
  key: string;
  label: string;
  entries: { value: string; label: string }[];
};

const noSubscription = () => () => {};

/** False while the server renders and until the browser has hydrated the page – what needs JavaScript waits for it. */
function useHydrated(): boolean {
  return useSyncExternalStore(noSubscription, () => true, () => false);
}

/**
 * Choosing many entries out of a long list (UX guideline G27): every entry a native checkbox posted under `name`, the
 * entries in groups that fold – a native `<details>`, so a group opens without JavaScript – and are closed when the page
 * opens, except groups with a choice in them (after a rejection the person sees what they sent). A header names the
 * group and how many of it are chosen; with JavaScript the count follows every tick and „Alle auswählen“ ticks the
 * whole group – without it the count says what was chosen when the page opened and the entries are ticked one by one.
 *
 * No domain logic and no texts of its own: the texts come as props. Key it on the form's rejection, so a rejection
 * starts it again from `chosen`.
 */
export function GroupedChoice({
  name,
  groups,
  chosen: initiallyChosen,
  header,
  selectAll,
}: {
  /** The name each ticked entry is posted under. */
  name: string;
  groups: ChoiceGroup[];
  /** The values chosen when the page opens. */
  chosen: readonly string[];
  /** „Flipper · EM – 4 von 6 ausgewählt“ */
  header: (group: string, chosen: number, total: number) => string;
  /** „Alle auswählen“ – shown only with JavaScript. */
  selectAll: string;
}) {
  const hydrated = useHydrated();
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set(initiallyChosen));
  // Which groups open with the page: the ones with a choice in them at that moment – decided once.
  const [openWithPage] = useState(
    () => new Set(groups.filter((group) => group.entries.some((entry) => initiallyChosen.includes(entry.value))).map((group) => group.key)),
  );

  const toggle = (value: string, ticked: boolean) =>
    setChosen((now) => {
      const next = new Set(now);
      if (ticked) next.add(value);
      else next.delete(value);
      return next;
    });
  const tickAll = (group: ChoiceGroup) =>
    setChosen((now) => new Set([...now, ...group.entries.map((entry) => entry.value)]));

  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => (
        <details key={group.key} open={openWithPage.has(group.key) || undefined} className="rounded-md border px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">
            <span>
              {header(group.label, group.entries.filter((entry) => chosen.has(entry.value)).length, group.entries.length)}
            </span>
            {hydrated && (
              <button
                type="button"
                onClick={() => tickAll(group)}
                className="ml-3 text-sm font-normal underline underline-offset-4"
              >
                {selectAll}
              </button>
            )}
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {group.entries.map((entry) => (
              <li key={entry.value}>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={name}
                    value={entry.value}
                    checked={chosen.has(entry.value)}
                    onChange={(event) => toggle(entry.value, event.target.checked)}
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span className="min-w-0">{entry.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
