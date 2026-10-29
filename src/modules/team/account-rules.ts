/**
 * What an account needs (ST-004, ST-005) – the same rules wherever an account is created or a password is set:
 * the one-off setup of the first technician and a technician managing accounts in the app.
 */
export const MIN_PASSWORD_LENGTH = 10;

/** Better Auth refuses a longer password at login (its default) – one stored longer could never be used (ST-088 review). */
export const MAX_PASSWORD_LENGTH = 128;

/** What Better Auth's username plugin accepts at login (3–30 of a-z, 0-9, _ and .) – its createUser skips the check. */
const VALID_USERNAME = /^[a-zA-Z0-9_.]{3,30}$/;

export type AccountRuleError = "name-required" | "username-invalid" | "password-too-short" | "password-too-long";

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
  return nameAndUsernameRejection(input) ?? passwordRejection(input.password);
}

/**
 * The reason an edited account is rejected (ST-088), or undefined when it is fine – the rules of a new account, with an
 * empty new password meaning "keep the password".
 */
export function editedAccountRejection(input: {
  name: string;
  username: string;
  newPassword: string;
}): AccountRuleError | undefined {
  return nameAndUsernameRejection(input) ?? (input.newPassword ? passwordRejection(input.newPassword) : undefined);
}

function nameAndUsernameRejection(input: { name: string; username: string }): AccountRuleError | undefined {
  if (!input.name.trim()) return "name-required";
  if (!VALID_USERNAME.test(normalizedUsername(input.username))) return "username-invalid";
  return undefined;
}

/** The reason a password is rejected, or undefined when its length is within the bounds. */
export function passwordRejection(password: string): "password-too-short" | "password-too-long" | undefined {
  if (password.length < MIN_PASSWORD_LENGTH) return "password-too-short";
  return password.length > MAX_PASSWORD_LENGTH ? "password-too-long" : undefined;
}
