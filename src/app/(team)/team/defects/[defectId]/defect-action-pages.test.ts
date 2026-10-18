import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defectActions } from "@/modules/repair";
import { defectActionPages, defectDoneAddress, defectFormAddress, doneActionOf } from "./defect-action-pages";

describe("the defect actions in the app (architecture review 2026-10-18)", () => {
  it("has a form folder with a page for every action that names one", () => {
    const missing = Object.values(defectActionPages).flatMap((page) =>
      "form" in page && !existsSync(join(__dirname, page.form.path, "page.tsx")) ? [page.form.path] : [],
    );

    expect(missing).toEqual([]);
    expect(defectFormAddress("d-1", "log-work")).toBe("/team/defects/d-1/arbeitsschritt");
  });

  it("reads back from the address only an action there is – every one the page can return with", () => {
    for (const action of defectActions)
      expect(doneActionOf(new URL(defectDoneAddress("d-1", action), "http://x").searchParams.get("done") ?? "")).toBe(
        action,
      );
    expect(doneActionOf("delete-everything")).toBeUndefined();
    expect(doneActionOf(["claim", "release"])).toBeUndefined();
    expect(doneActionOf(undefined)).toBeUndefined();
  });
});
