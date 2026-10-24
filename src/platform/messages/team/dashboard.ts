/**
 * The technician dashboard's texts (ST-048) – it shows what several contexts answer.
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
  },
  /** The helper dashboard (ST-049): what a helper can do right now, in words (G7, G18). */
  helperDashboard: {
    claimedByYou: "Von dir übernommen",
    noneClaimed: "Du hast keinen Defekt übernommen.",
    suitableForHelpers: "Für Helfer:innen geeignet",
    noneSuitable: "Gerade ist kein Defekt für Helfer:innen offen.",
    dueMaintenance: "Fällige Wartung für Helfer:innen",
    due: (name: string, machines: number, overdue: number) =>
      `„${name}“ ist an ${machines === 1 ? "1 Gerät" : `${machines} Geräten`} fällig${
        overdue === 0
          ? ""
          : overdue === machines
            ? machines === 1
              ? " – überfällig"
              : " – an allen überfällig"
            : `, ${overdue} davon überfällig`
      }.`,
    openDueMaintenance: "Zur Wartung",
    nothingOpen: "Gerade ist nichts für dich offen.",
  },
} as const;
