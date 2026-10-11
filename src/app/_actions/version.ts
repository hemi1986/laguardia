/**
 * The version of an aggregate a form posts (HS-16): the version its page showed, as a hidden field. A form on an
 * existing aggregate reads it with `versionSeen` in its input function and renders it with `VersionField`.
 */

/** A version nobody saw – the command layer answers it with a conflict. */
export const NO_VERSION_SEEN = -1;

/** A posted whole number; undefined for anything else (the empty-field rule: no value given). */
export function wholeNumber(value: string | undefined): number | undefined {
  const number = Number(value);
  return value && Number.isInteger(number) ? number : undefined;
}

/**
 * The version the acting person saw – a posted value that is no whole number is a version nobody saw, never a guess
 * at the stored one.
 */
export function versionSeen(value: string | undefined): number {
  return wholeNumber(value) ?? NO_VERSION_SEEN;
}
