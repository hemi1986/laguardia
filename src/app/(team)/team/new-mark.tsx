import { teamMessages } from "@/platform/messages";

/** „· neu seit deinem letzten Besuch“ at the end of a dashboard entry that is new (ST-050, G6a) – nothing otherwise. */
export function NewMark({ shown }: { shown: boolean }) {
  return shown ? (
    <>
      {" · "}
      <strong className="font-medium">{teamMessages.newSinceLastVisit}</strong>
    </>
  ) : null;
}
