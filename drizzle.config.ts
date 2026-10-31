import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "";
const connects = process.argv.some((a) => ["migrate", "push", "pull", "studio"].includes(a));
if (connects && !url) {
  throw new Error(
    "DATABASE_URL is not set – put it into .env.development.local (see .env.example) or export it before running drizzle-kit.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/modules/*/schema.ts", "./src/platform/schema.ts", "./src/upload/schema.ts"],
  out: "./drizzle",
  dbCredentials: { url },
});
