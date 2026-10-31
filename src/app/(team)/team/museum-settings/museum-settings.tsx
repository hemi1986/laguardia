import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Confirmation } from "@/components/ui/message";
import { Section } from "@/components/ui/section";
import { teamMessages } from "@/platform/messages";
import { LogoForm } from "./logo-form";
import { MuseumForm } from "./museum-form";
import type { MuseumSettingsData } from "./museum-settings-data";

const texts = teamMessages.museumSettings;

/**
 * The museum settings (ST-100, G18): how the museum presents itself to visitors. Below the heading the way to the
 * welcome page (G17), then one framed section per form, each saved on its own (G29) – „Museum“, „Logo“ (ST-102), and
 * „Rechtstexte“ (ST-103) follows. A saved form confirms itself in its section (G3).
 */
export function MuseumSettingsView({ settings, saved, logo }: MuseumSettingsData) {
  return (
    <>
      <Link href="/" className={buttonVariants({ variant: "link", className: "self-start px-0" })}>
        {texts.toWelcomePage}
      </Link>
      <Section title={texts.museum.title} contentClassName="flex flex-col gap-4">
        {saved === "museum" && <Confirmation>{texts.museum.saved}</Confirmation>}
        <MuseumForm
          version={settings.museumDetailsVersion}
          museumName={settings.museumName}
          machinesListed={settings.machinesListed}
        />
      </Section>
      <Section title={texts.logo.title} contentClassName="flex flex-col gap-4">
        {logo.confirmed === "replaced" && <Confirmation>{texts.logo.saved}</Confirmation>}
        {logo.confirmed === "removed" && <Confirmation>{texts.logo.removed}</Confirmation>}
        {logo.hasLogo ? (
          logo.address && (
            // A presigned address of the private store, valid 5 minutes – nothing next/image could optimise.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo.address} alt={texts.logo.current} className="max-h-40 w-auto self-start rounded-md" />
          )
        ) : (
          <p>{texts.logo.none}</p>
        )}
        <LogoForm version={logo.version} hasLogo={logo.hasLogo} />
      </Section>
    </>
  );
}
