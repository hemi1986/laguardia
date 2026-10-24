import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repositoryFiles } from "@/test-support/repository-files";

/**
 * La Guardia sends no e-mail and no push notification (`docs/product/vision.md`, Non-Goals; ADR 0004): the dashboards
 * mark what is new instead (ST-050). This scan fails when a way to send one comes into the code or the dependencies –
 * none exists today, so a test of the behaviour can only look for the means.
 */
const means: { name: string; pattern: RegExp }[] = [
  {
    name: "a mail-sending dependency",
    pattern:
      /["'](nodemailer|resend|@sendgrid\/[\w-]+|postmark|mailgun[\w.-]*|@aws-sdk\/client-sesv?2?|@react-email\/[\w-]+)["']/,
  },
  { name: "a push dependency", pattern: /["'](web-push|firebase-admin|@novu\/[\w-]+|onesignal[\w-]*)["']/ },
  {
    name: "the browser's push or notification API",
    pattern: /\b(pushManager|PushManager|new Notification\(|Notification\.requestPermission)/,
  },
  { name: "a mail address to send to", pattern: /\bmailto:|\bsendMail\(|\bsmtp:\/\//i },
];

const thisFile = "src/platform/no-notifications.test.ts";

function meansIn(file: string, text: string): string[] {
  return text
    .split("\n")
    .flatMap((line, index) =>
      means.filter(({ pattern }) => pattern.test(line)).map(({ name }) => `${file}:${index + 1}: ${name}`),
    );
}

describe("no notifications", () => {
  it("ST-050: No notifications are sent", () => {
    const files = repositoryFiles(thisFile);

    expect(files).toContain("package.json");
    expect(files).toContain("src/modules/repair/report-problem-command.ts");
    expect(files.flatMap((file) => meansIn(file, readFileSync(file, "utf8")))).toEqual([]);
  });

  it("finds each way to send a notification when it is added", () => {
    expect(meansIn("package.json", '    "nodemailer": "^6.9.0",')).toEqual([
      "package.json:1: a mail-sending dependency",
    ]);
    expect(meansIn("src/x.ts", 'import webpush from "web-push";')).toEqual(["src/x.ts:1: a push dependency"]);
    expect(meansIn("src/x.tsx", "await registration.pushManager.subscribe(options);")).toEqual([
      "src/x.tsx:1: the browser's push or notification API",
    ]);
    expect(meansIn("src/x.tsx", 'new Notification("Neue Meldung")')).toEqual([
      "src/x.tsx:1: the browser's push or notification API",
    ]);
    expect(meansIn("src/x.ts", "await transport.sendMail({ to });")).toEqual(["src/x.ts:1: a mail address to send to"]);
    expect(meansIn("src/x.ts", 'const text = "Neu seit deinem letzten Besuch";')).toEqual([]);
  });
});
