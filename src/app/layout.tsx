import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "La Guardia",
  description: "Repairs, defects and manuals for the pinball museum",
};

/**
 * Every page is rendered per request: Next.js puts the request's nonce on its scripts only while rendering, and a page
 * rendered at build time would carry none – its scripts would be blocked (ST-070).
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  return (
    <html lang="de" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
