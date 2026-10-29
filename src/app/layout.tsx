import { cn } from "cn";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { currentDeviceDesign } from "./current-design";
import { PAGE_PATH_HEADER, designOf } from "./design";
import { DesignFollowsPage } from "./design-follows-page";
import "./globals.css";

export const metadata: Metadata = {
  title: "La Guardia",
  description: "Repairs, defects and manuals for the pinball museum",
};

/**
 * Every page is rendered per request: Next.js puts the request's nonce on its scripts only while rendering, and a page
 * rendered at build time would carry none – its scripts would be blocked (ST-070).
 *
 * The page arrives in its design (ST-090, G26): the class `dark` on `<html>` is decided here, from the page's path (the
 * proxy passes it) and the device's choice – no script written into the page, also without JavaScript.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  const [requestHeaders, device] = await Promise.all([headers(), currentDeviceDesign()]);
  const design = designOf(requestHeaders.get(PAGE_PATH_HEADER) ?? "/", device);
  return (
    <html lang="de" className={cn("h-full antialiased", design === "dark" && "dark")}>
      <body className="flex min-h-full flex-col">
        {children}
        <DesignFollowsPage device={device} />
      </body>
    </html>
  );
}
