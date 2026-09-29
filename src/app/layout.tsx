import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

/** The font shadcn's init added; `--font-sans` is what the theme tokens in globals.css refer to. */
const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "La Guardia",
  description: "Repairs, defects and manuals for the pinball museum",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`h-full font-sans antialiased ${geist.variable}`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
