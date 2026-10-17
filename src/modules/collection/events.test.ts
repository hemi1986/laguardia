import { describe, expect, it } from "vitest";
import { domainEventAggregates } from "@/test-support/domain-events";
import { collectionEvents } from "./events";

describe("collectionEvents", () => {
  it("lists only events of the event storming model, each on an aggregate the model allows for its journal entry", () => {
    const model = domainEventAggregates();
    for (const [type, entry] of Object.entries(collectionEvents.entries)) {
      expect({ type, allowed: model.get(type)?.has(entry.aggregate) }).toEqual({ type, allowed: true });
    }
  });
});
