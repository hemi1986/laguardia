import Link from "next/link";
import { Page } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { visitorMessages } from "@/platform/messages";

const { home } = visitorMessages("de");

/**
 * The start page (ST-078): a public placeholder with the museum's name and the way to the team login – replaced
 * by the visitor machine page (ST-010) and the legal pages (ST-064). It stays reachable without login.
 */
export default function Home() {
  return (
    <Page title={home.museum}>
      <Link href="/login" className={buttonVariants({ variant: "link", className: "self-start px-0" })}>
        {home.teamLogin}
      </Link>
    </Page>
  );
}
