import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, username } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access";
import type { Database } from "@/platform/command";
import { account, session, teamMember, verification } from "./schema";

/**
 * Better Auth for team member accounts (ADR 0004, ADR 0006) – internal to the Team module.
 * No HTTP endpoints are mounted: pages and Server Actions call it on the server only, so there is no public
 * sign-up, and the CSRF check of src/proxy.ts covers every login and logout.
 */
export const SESSION_DAYS = 90;

// Roles (CONTEXT.md): technicians manage accounts (ADR 0004, ST-005); helpers have no account permissions.
const ac = createAccessControl(defaultStatements);
const roles = { technician: ac.newRole(adminAc.statements), helper: ac.newRole(userAc.statements) };

export function createAuth(db: Database, options: { inNext: boolean }) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set – see .env.example");
  return betterAuth({
    secret,
    baseURL: process.env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { team_member: teamMember, session, account, verification },
    }),
    user: { modelName: "team_member" },
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 10 },
    session: {
      expiresIn: SESSION_DAYS * 24 * 60 * 60, // 90 days without use (ST-004) …
      updateAge: 24 * 60 * 60, // … extended at most once a day while in use
      cookieCache: { enabled: false }, // the role is read again on every request
    },
    advanced: { database: { generateId: "uuid" } },
    plugins: [
      username(),
      admin({
        ac,
        roles,
        defaultRole: "helper",
        adminRoles: ["technician"],
      }),
      ...(options.inNext ? [nextCookies()] : []),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const instances = new WeakMap<object, Auth>();

/** One Better Auth instance per database handle. `inNext` adds the plugin that lets Server Actions set cookies. */
export function authFor(db: Database, inNext = false): Auth {
  let auth = instances.get(db);
  if (!auth) {
    auth = createAuth(db, { inNext });
    instances.set(db, auth);
  }
  return auth;
}
