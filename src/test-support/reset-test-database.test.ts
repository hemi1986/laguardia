import { describe, expect, it } from "vitest";
import { resetDatabase } from "./reset-test-database";

/**
 * The reset drops everything in a database – it may only ever touch a test database (name ending in `_test`). The
 * check comes before any connection, so it holds even with nothing listening (ST-083).
 */
describe("resetting a database", () => {
  it.each([
    ["the development database", "postgres://laguardia:laguardia@localhost:5433/laguardia", "laguardia"],
    ["a browser-test name without _test", "postgres://laguardia:laguardia@localhost:5433/laguardia_e2e", "laguardia_e2e"],
    ["a production-looking database", "postgres://user:secret@ep-quiet-fog.eu-central-1.aws.neon.tech/neondb", "neondb"],
  ])("refuses %s, naming it", async (_case, url, name) => {
    await expect(resetDatabase(new URL(url))).rejects.toThrow(`Refusing to reset "${name}"`);
  });
});
