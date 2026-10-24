/**
 * The dashboards' texts (ST-048, ST-049, ST-058) – it shows what several contexts answer.
 */
export const dashboardTexts = {
  /** The technician dashboard (ST-048): what needs a technician right now, in words (G6, G6a, G7). */
  technicianDashboard: {
    toTriage: "Meldungen zur Sichtung",
    waiting: (count: number, waitingLong: number) =>
      `${count === 1 ? "1 Meldung wartet" : `${count} Meldungen warten`} auf die Sichtung${
        waitingLong === 0
          ? ""
          : waitingLong === count
            ? count === 1
              ? " – länger als 3 Tage"
              : " – alle länger als 3 Tage"
            : ` – ${waitingLong} davon länger als 3 Tage`
      }.`,
    openTriage: "Zur Sichtung",
    noneToTriage: "Keine Meldung wartet auf die Sichtung.",
    toReturnToPlay: "Nicht spielbereit ohne offenen Defekt",
    withoutOpenDefects: (status: string) => `${status} · kein offener Defekt`,
    noneToReturnToPlay: "Kein Gerät wartet auf die Rückkehr ins Spiel.",
    nothingNeedsAttention: "Gerade braucht nichts deine Aufmerksamkeit.",
    /** Section 3 (ST-058) – the reason in words (G6a). */
    staleClaims: "Liegengeblieben",
    staleBecause: (claimant: string) =>
      `Von ${claimant} vor mehr als 14 Tagen übernommen, seitdem kein Arbeitsschritt.`,
    noneStale: "Kein Defekt ist liegengeblieben.",
    /** Section 4 (ST-058) – counted, never listed by machine (G18). */
    overdueMaintenance: "Überfällige Wartung",
    overdue: (name: string, machines: number) =>
      `„${name}“ ist an ${machines === 1 ? "1 Gerät" : `${machines} Geräten`} überfällig.`,
    openDueMaintenance: "Zur Wartung",
    noneOverdue: "Keine Wartung ist überfällig.",
    /** Section 5 (ST-058) – after the machine's museum number or the defect's title. */
    recentChanges: "Letzte Änderungen",
    statusChanged: (from: string, to: string, by: string, at: string) => `${from} → ${to} · ${by} · ${at}`,
    defectChanged: (kind: "resolved" | "reopened", museumNumber: string, by: string, at: string) =>
      `(${museumNumber}) ${kind === "resolved" ? "behoben" : "wieder geöffnet"} · ${by} · ${at}`,
    noRecentChanges: "Keine Änderungen in den letzten 7 Tagen.",
  },
  /** The helper dashboard (ST-049): what a helper can do right now, in words (G7, G18). */
  helperDashboard: {
    claimedByYou: "Von dir übernommen",
    noneClaimed: "Du hast keinen Defekt übernommen.",
    suitableForHelpers: "Für Helfer:innen geeignet",
    noneSuitable: "Gerade ist kein Defekt für Helfer:innen offen.",
    /** Section 2 leaves out the helper's own claims, so next to them it says „weiterer“ (user, 2026-10-24). */
    noFurtherSuitable: "Gerade ist kein weiterer Defekt für Helfer:innen offen.",
    dueMaintenance: "Fällige Wartung für Helfer:innen",
    due: (name: string, machines: number, overdue: number) =>
      machines === 1
        ? `„${name}“ ist an 1 Gerät ${overdue === 0 ? "fällig" : "überfällig"}.`
        : `„${name}“ ist an ${machines} Geräten fällig${
            overdue === 0 ? "" : overdue === machines ? " – an allen überfällig" : `, ${overdue} davon überfällig`
          }.`,
    openDueMaintenance: "Zur Wartung",
    nothingOpen: "Gerade ist nichts für dich offen.",
    /** What changed on a claimed defect (ST-086, G25): who and what, then when in words – „vor …“ as the triage list counts. */
    changes: {
      takenOver: (by: string) => `${by} hat übernommen`,
    },
    changed: (what: string, hoursAgo: number) =>
      `${what} · ${
        hoursAgo < 1
          ? "vor weniger als 1 Stunde"
          : hoursAgo < 24
            ? `vor ${hoursAgo} ${hoursAgo === 1 ? "Stunde" : "Stunden"}`
            : `vor ${Math.floor(hoursAgo / 24)} ${Math.floor(hoursAgo / 24) === 1 ? "Tag" : "Tagen"}`
      }`,
  },
} as const;
