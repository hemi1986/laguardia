import { eq, sql } from "drizzle-orm";
import { Rejected, type Database } from "@/platform/command";
import { machine, museumNumber } from "./schema";

/**
 * The museum number register of the Collection module (ST-035, architecture review 2026-10-02): the one place that
 * knows what a museum number is – its format, the next one La Guardia assigns, the set of all given out (in use, of
 * retired machines, and reserved after a correction, D11), giving one to a machine, and finding the machine of one.
 * CMD-RegisterMachine and CMD-CorrectMachineDetails both go through it; nothing else writes `museum_number`.
 *
 * Uniqueness is a set-based rule (HS-17): every read for a decision and every write takes the same transaction-scoped
 * advisory lock (re-entrant within a transaction), so writes of museum numbers run one after the other; the unique
 * constraints stay the final guarantee and are answered with `museum-number-taken` here, in one place.
 */

/** "LG-" plus three digits (user 2026-09-26) – the format La Guardia assigns and the stickers print. */
const MUSEUM_NUMBER = /^LG-\d{3}$/;
const HIGHEST = 999;

export function isMuseumNumber(text: string): boolean {
  return MUSEUM_NUMBER.test(text);
}

/**
 * The museum number La Guardia assigns (HS-19, D11): the next one above the highest given out so far; after LG-999
 * the next free one below it, counting down (user 2026-10-01). Undefined when LG-001 to LG-999 are all given out.
 */
export function nextMuseumNumber(givenOut: ReadonlySet<string>): string | undefined {
  // Only numbers in the format count – one stored otherwise (by hand, an import) must not break the assignment.
  const numbers = [...givenOut].filter(isMuseumNumber).map((number) => Number(number.slice(3)));
  const highest = Math.max(0, ...numbers);
  if (highest < HIGHEST) return museumNumberOf(highest + 1);
  for (let number = HIGHEST - 1; number >= 1; number--) {
    if (!givenOut.has(museumNumberOf(number))) return museumNumberOf(number);
  }
  return undefined;
}

function museumNumberOf(number: number): string {
  return `LG-${String(number).padStart(3, "0")}`;
}

/** Every museum number given out – for a command's facts. Takes the lock: the set stays true until the commit. */
export async function museumNumbersGivenOut(tx: Database): Promise<string[]> {
  await lockMuseumNumbers(tx);
  const rows = await tx.select({ museumNumber: museumNumber.museumNumber }).from(museumNumber);
  return rows.map((row) => row.museumNumber);
}

/**
 * Writes a machine whose museum number may be new (`write`: the machine row, false when its version check failed),
 * then gives that museum number to the machine – an earlier one of it stays given out, as a reserved museum number.
 * Under the lock, also when the command read no facts; a number taken all the same is `museum-number-taken`.
 */
export async function withMuseumNumber(
  tx: Database,
  owner: { id: string; museumNumber: string },
  write: () => Promise<boolean>,
): Promise<boolean> {
  await lockMuseumNumbers(tx);
  try {
    if (!(await write())) return false;
    const [given] = await tx
      .select({ machineId: museumNumber.machineId })
      .from(museumNumber)
      .where(eq(museumNumber.museumNumber, owner.museumNumber));
    if (given?.machineId === owner.id) return true;
    if (given) throw new Rejected("museum-number-taken");
    await tx.insert(museumNumber).values({ museumNumber: owner.museumNumber, machineId: owner.id });
    return true;
  } catch (error) {
    if (isMuseumNumberTaken(error)) throw new Rejected("museum-number-taken");
    throw error;
  }
}

/**
 * The machine a museum number – its current one or a reserved one – belongs to, with its current museum number:
 * an old QR sticker keeps leading to its machine (ST-035). Undefined for a number never given out.
 */
export async function machineOfMuseumNumber(
  db: Database,
  number: string,
): Promise<{ machineId: string; museumNumber: string } | undefined> {
  const [row] = await db
    .select({ machineId: machine.id, museumNumber: machine.museumNumber })
    .from(museumNumber)
    .innerJoin(machine, eq(museumNumber.machineId, machine.id))
    .where(eq(museumNumber.museumNumber, number));
  return row;
}

function lockMuseumNumbers(tx: Database) {
  return tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('museum-number'))`);
}

/** A unique violation of a museum number – the machine's own column or the set of all given out. */
function isMuseumNumberTaken(error: unknown): boolean {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  const { code, constraint } = (cause ?? {}) as { code?: string; constraint?: string };
  return code === "23505" && (constraint === "machine_museum_number_unique" || constraint === "museum_number_pkey");
}
