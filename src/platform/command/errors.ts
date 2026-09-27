/** Outcomes the command layer turns into `not-found` / `version-conflict` – thrown to roll the transaction back. */
export class NotFound extends Error {}

export class VersionConflict extends Error {}

export class Rejected extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}
