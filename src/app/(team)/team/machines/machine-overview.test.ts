import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MachineOverview } from "./machine-overview";

/**
 * The machine overview's view, rendered on its own: browser tests run against databases other tests share (and the
 * preview), where the list is never empty – the empty state can only be shown here (user, 2026-10-01).
 */
function rendered(props: Parameters<typeof MachineOverview>[0]): string {
  return renderToStaticMarkup(createElement(MachineOverview, props));
}

describe("the machine overview", () => {
  it("ST-007: No machine registered yet", () => {
    const html = rendered({ machines: [], canRegister: true });

    expect(html).toContain("Noch kein Gerät erfasst.");
    expect(html).toMatch(/<a [^>]*href="\/team\/machines\/new"[^>]*>Gerät erfassen<\/a>/);
  });
});
