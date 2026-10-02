import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MachineOverview } from "./machine-overview";

/**
 * The machine overview's view, rendered on its own: browser tests run against databases other tests share (and the
 * preview), where the list is never empty – the empty state can only be shown here (user, 2026-10-01).
 */
type Props = Parameters<typeof MachineOverview>[0];

const noCounts = { playable: 0, limited: 0, "out-of-order": 0, "not-on-display": 0 };

function rendered(props: Partial<Props>): string {
  return renderToStaticMarkup(
    createElement(MachineOverview, { machines: [], counts: noCounts, query: {}, canRegister: false, ...props }),
  );
}

describe("the machine overview", () => {
  it("ST-007: No machine registered yet", () => {
    const html = rendered({ canRegister: true });

    expect(html).toContain("Noch kein Gerät erfasst.");
    expect(html).toMatch(/<a [^>]*href="\/team\/machines\/new"[^>]*>Gerät erfassen<\/a>/);
  });

  it("ST-008: No machine has the filtered machine status", () => {
    const html = rendered({ counts: { ...noCounts, playable: 12 }, query: { machineStatus: "out-of-order" } });

    expect(html).toContain("Kein Gerät ist Außer Betrieb.");
    expect(html).not.toContain("Noch kein Gerät erfasst.");
    expect(html).not.toContain("<article");
  });

  it("labels every machine status count in words – a zero included, so it can still be filtered for", () => {
    const html = rendered({ counts: { playable: 45, limited: 6, "out-of-order": 0, "not-on-display": 5 } });

    for (const count of ["Alle · 56", "Spielbereit · 45", "Eingeschränkt · 6", "Außer Betrieb · 0", "Nicht ausgestellt · 5"]) {
      expect(html).toContain(count);
    }
    expect(html).toMatch(/href="\/team\/machines\?machineStatus=out-of-order"/);
  });
});
