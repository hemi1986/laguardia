import { describe, expect, it } from "vitest";
import { domainEventAggregates } from "@/test-support/domain-events";
import { aiAssistanceEvents } from "./events";

describe("aiAssistanceEvents", () => {
  it("lists only events of the event storming model, each on an aggregate the model allows for its journal entry", () => {
    const model = domainEventAggregates();
    for (const [type, entry] of Object.entries(aiAssistanceEvents.entries)) {
      expect({ type, allowed: model.get(type)?.has(entry.aggregate) }).toEqual({ type, allowed: true });
    }
  });
});
