/**
 * What an account needs (ST-004, ST-005) – the same rules wherever an account is created or a password is set:
 * the one-off setup of the first technician and a technician managing accounts in the app.
 */
export const MIN_PASSWORD_LENGTH = 10;

/** What Better Auth's username plugin accepts at login (3–30 of a-z, 0-9, _ and .) – its createUser skips the check. */
const VALID_USERNAME = /^[a-zA-Z0-9_.]{3,30}$/;

export type AccountRuleError = "name-required" | "username-invalid" | "password-too-short";

/** What makes two spellings the same username – used wherever one is created, checked or logged in with. */
export function normalizedUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** The reason a new account is rejected, or undefined when name, username and password are fine. */
export function newAccountRejection(input: {
  name: string;
  username: string;
  password: string;
}): AccountRuleError | undefined {
  if (!input.name.trim()) return "name-required";
  if (!VALID_USERNAME.test(normalizedUsername(input.username))) return "username-invalid";
  return passwordRejection(input.password);
}

/** The reason a password is rejected, or undefined when it is long enough. */
export function passwordRejection(password: string): "password-too-short" | undefined {
  return password.length < MIN_PASSWORD_LENGTH ? "password-too-short" : undefined;
}
