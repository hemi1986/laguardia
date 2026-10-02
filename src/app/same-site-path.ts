/**
 * A path of this site to go back to after the language switch (ST-010): "/" followed by nothing a browser could read
 * as another host – no "//", no backslash, no whitespace or control characters. Anything else goes to "/".
 */
export function sameSitePath(back: string): string {
  return /^\/(?![/\\])[^\s\\]*$/.test(back) ? back : "/";
}
