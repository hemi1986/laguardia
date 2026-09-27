/**
 * One-off setup (ST-004): creates the first technician account of an empty La Guardia.
 *
 *   npm run setup:first-technician            (local database from .env.development.local)
 *   DATABASE_URL=… npm run setup:first-technician   (e.g. production, from `vercel env pull`)
 *
 * Asks for name, username and password (hidden); refuses when any account exists.
 */
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { setUpFirstTechnician } from "@/modules/team";
import { database } from "@/platform/database";

async function main() {
  const muted = { on: false };
  const output = new Writable({
    write(chunk, _encoding, done) {
      if (!muted.on) process.stdout.write(chunk);
      done();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) });
  const lines = rl[Symbol.asyncIterator](); // buffers lines, so piped input works too
  const ask = async (prompt: string, hidden = false) => {
    process.stdout.write(prompt);
    muted.on = hidden;
    const { value } = await lines.next();
    muted.on = false;
    if (hidden) process.stdout.write("\n");
    return String(value ?? "");
  };
  const name = await ask("Name: ");
  const username = await ask("Username: ");
  const password = await ask("Password (at least 10 characters): ", true);
  rl.close();

  const outcome = await setUpFirstTechnician(database(), { name, username, password });
  if (outcome.ok) {
    console.log(`Technician account "${username}" created.`);
    process.exit(0);
  }
  console.error(
    outcome.error === "accounts-exist"
      ? "Team member accounts exist already – nothing was created or changed."
      : "The password must have at least 10 characters – nothing was created.",
  );
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
