/**
 * The parts every form of a command on an existing aggregate repeats (architecture review 2026-10-11) – so the rules
 * that make a rejected form keep its input, with and without JavaScript, are written once.
 */

/** The version of the aggregate the page showed, posted with the form (HS-16) – read with `versionSeen`. */
export function VersionField({ version, name = "version" }: { version: number; name?: string }) {
  return <input type="hidden" name={name} value={version} />;
}

/**
 * The key for a field that shows what was typed after a rejection: it changes with every action state, so React
 * renders the field anew with the kept value as its default – its form reset would otherwise drop it (ST-073).
 * Use it as `key={`<field>-${keptKey(state)}`}` beside `defaultValue={state?.values.<field>}`.
 */
export function keptKey(state: unknown): string {
  return state ? JSON.stringify(state) : "empty";
}
