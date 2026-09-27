import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "";
const connects = process.argv.some((a) => ["migrate", "push", "pull", "studio"].includes(a));
if (connects && !url) {
  throw new Error(
    "DATABASE_URL is not set – pull it with `npx vercel env pull` or export it before running drizzle-kit.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/*/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
