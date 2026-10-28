/** Outcomes the command layer turns into `not-found` / `version-conflict` – thrown to roll the transaction back. */
export class NotFound extends Error {}

export class VersionConflict extends Error {}

export class Rejected extends Error {
  constructor(
    readonly reason: string,
    /** The IDs that caused it, when the decision names them (`Decision`). */
    readonly subjects?: readonly string[],
  ) {
    super(reason);
  }
}
