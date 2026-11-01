import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { teamMessages } from "@/platform/messages";
import { RequestAiAssessmentForm } from "./request-form";

/**
 * The form „KI-Einschätzung anfordern“ (ST-107): its German texts and its refusal state, rendered directly – the page
 * state the shared databases can never show (a viewer the command would refuse).
 */
const { aiAssessments: texts } = teamMessages;
const anAction = async () => null;

describe("the request form", () => {
  it("shows the decided texts", () => {
    const html = renderToStaticMarkup(
      createElement(RequestAiAssessmentForm, { action: anAction, whyNot: undefined, maxPhotos: 5 }),
    );

    expect(html).toContain(texts.note);
    expect(html).toContain("Fotos (freiwillig, höchstens 5)");
    expect(html).toContain(texts.hint);
    expect(html).toContain("KI-Einschätzung anfordern");
  });

  it("shows the command's reason in place of the form where it would refuse", () => {
    const html = renderToStaticMarkup(
      createElement(RequestAiAssessmentForm, {
        action: anAction,
        whyNot: "ai-assessment-defect-not-open",
        maxPhotos: 5,
      }),
    );

    expect(html).toContain("Eine KI-Einschätzung gibt es nur für offene Defekte.");
    expect(html).not.toContain(texts.hint);
  });
});
