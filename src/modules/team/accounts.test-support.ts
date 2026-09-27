import type { Database } from "@/platform/command";
import { authFor } from "./auth";

/** A team member account for tests – creating accounts properly is ST-005. Only imported by tests. */
export async function aTeamMemberAccount(
  db: Database,
  account: { name: string; username: string; role: "helper" | "technician"; password: string },
): Promise<{ id: string }> {
  const { user } = await authFor(db).api.createUser({
    body: {
      name: account.name,
      email: `${account.username}@users.invalid`,
      password: account.password,
      role: account.role,
      data: { username: account.username },
    },
  });
  return { id: user.id };
}

/** `Set-Cookie` headers → the `Cookie` header a browser would send back. */
export function cookieHeader(setCookies: string[]): string {
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}
