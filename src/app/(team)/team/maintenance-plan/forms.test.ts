import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChangeMaintenanceTaskForm } from "./[maintenanceTaskId]/change-maintenance-task-form";
import { AddMaintenanceTaskForm } from "./new/add-maintenance-task-form";

/**
 * The forms of a maintenance task (ST-040, ST-041, ST-094): no restriction to a machine category or technology and no
 * start date any more – which machines a task applies to is its own choice.
 */
describe("the forms of a maintenance task", () => {
  it("ST-094: The forms have no restriction and no start date", () => {
    const add = renderToStaticMarkup(createElement(AddMaintenanceTaskForm, { version: 0, groups: [] }));
    const change = renderToStaticMarkup(
      createElement(ChangeMaintenanceTaskForm, {
        version: 3,
        removed: false,
        task: { id: "task-1", name: "Wax playfield", instruction: "Wax it.", intervalMonths: "12", suitableForHelpers: true },
      }),
    );

    for (const [form, html] of [
      ["adding", add],
      ["changing", change],
    ] as const) {
      for (const field of ["machineCategory", "technology", "startDate"]) {
        expect(html, `${form}: ${field}`).not.toContain(`name="${field}"`);
      }
      for (const text of ["Nur für Kategorie", "Und nur für Technik", "Start"]) {
        expect(html, `${form}: ${text}`).not.toContain(text);
      }
      // What a task has is still there: its instruction, its interval and the mark.
      expect(html).toContain('name="instruction"');
      expect(html).toContain('name="intervalMonths"');
      expect(html).toContain('name="suitableForHelpers"');
    }
  });
});
