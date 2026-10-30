import Link from "next/link";

/**
 * A machine as an entry names it everywhere (ST-092, G5, G15): „LG-042 · Medieval Madness“ as one link to its machine
 * record – the machine overview's entry.
 */
export function MachineLink({ museumNumber, machineModelTitle }: { museumNumber: string; machineModelTitle: string }) {
  return (
    <Link
      href={`/team/machines/${encodeURIComponent(museumNumber)}`}
      className="self-start font-medium underline underline-offset-4"
    >
      {museumNumber} · {machineModelTitle}
    </Link>
  );
}
