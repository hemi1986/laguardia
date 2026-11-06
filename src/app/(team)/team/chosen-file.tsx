"use client";

import { useState } from "react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { rejectionText } from "@/app/_actions/rejection-text";
import type { TeamCommandErrorCode } from "@/platform/messages";
import { uploadFile } from "@/upload/browser";

/** The texts of the field „Datei“ and of what a rejection says about the chosen file – strings only (a client component). */
export type ChosenFileTexts = {
  file: string;
  fileHint: string;
  uploading: string;
  uploaded: string;
  tooLarge: string;
  notUploaded: string;
  stillAttached: string;
  chooseAgain: string;
};

/** The chosen file: uploading, uploaded (its content's name to send), or refused before it was attached. */
type Chosen =
  | { state: "uploading"; percent: number }
  | { state: "uploaded"; content: string; fileName: string }
  | { state: "failed"; text: string };

/**
 * The field „Datei“ of a form that adds a file (ST-037, ST-119): the chosen file is uploaded at once, straight to the
 * private store, while the person fills in the rest (ST-085); the form sends only its name (`content`) and the name the
 * file had on the device (`fileName`). `onChosen` hears the name of a file that was chosen – the overview's form fills
 * „Titel“ with it.
 */
export function ChosenFile({
  keptContent,
  keptFileName,
  texts,
  fieldProps,
  invalid,
  onUploading,
  onChosen,
}: {
  onUploading: (uploading: boolean) => void;
  onChosen?: (fileName: string) => void;
  keptContent: string | undefined;
  keptFileName: string | undefined;
  texts: ChosenFileTexts;
  fieldProps: { "aria-invalid"?: boolean; "aria-describedby"?: string };
  invalid: boolean;
}) {
  const [chosen, setChosen] = useState<Chosen | undefined>(
    keptContent ? { state: "uploaded", content: keptContent, fileName: keptFileName ?? "" } : undefined,
  );

  async function choose(file: File | undefined) {
    if (!file) return setChosen(undefined);
    onChosen?.(file.name);
    setChosen({ state: "uploading", percent: 0 });
    onUploading(true);
    const uploaded = await uploadFile(file, {
      onProgress: (percent) => setChosen({ state: "uploading", percent }),
    });
    onUploading(false);
    setChosen(
      uploaded.ok
        ? { state: "uploaded", content: uploaded.name, fileName: file.name }
        : { state: "failed", text: uploaded.error === "too-large" ? texts.tooLarge : texts.notUploaded },
    );
  }

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor="file">{texts.file}</FieldLabel>
      <Input id="file" type="file" onChange={(event) => void choose(event.target.files?.[0])} {...fieldProps} />
      <FieldDescription id="file-hint">{texts.fileHint}</FieldDescription>
      {chosen?.state === "uploading" && (
        <p role="status" className="text-sm">
          {texts.uploading.replace("{percent}", String(chosen.percent))}
        </p>
      )}
      {chosen?.state === "uploaded" && (
        <p role="status" className="text-sm break-all">
          {texts.uploaded.replace("{fileName}", chosen.fileName)}
        </p>
      )}
      {chosen?.state === "failed" && <Rejection>{chosen.text}</Rejection>}
      <input type="hidden" name="content" value={chosen?.state === "uploaded" ? chosen.content : ""} />
      <input type="hidden" name="fileName" value={chosen?.state === "uploaded" ? chosen.fileName : ""} />
    </Field>
  );
}

/**
 * The rejection, and what happened to the chosen file (G8a): still attached after a rejection of the form's own
 * fields, gone otherwise – except where the text itself says what to do (no file, too large). `ownFields` are the form's
 * own rejections, which never touch the file.
 */
export function rejectionWithChosenFile(
  state: { error: TeamCommandErrorCode; values: { content: string; fileName: string } },
  texts: ChosenFileTexts,
  ownFields: readonly string[],
): string {
  const reason = rejectionText(state.error, { "too-large": texts.tooLarge });
  if (state.error === "file-required" || state.error === "too-large") return reason;
  if (state.values.content) return `${reason} ${texts.stillAttached.replace("{fileName}", state.values.fileName)}`;
  // No file named: either none was chosen (a rejection of the form's own fields – nothing to say about a file), or the
  // one handed over is gone with the rejection.
  return ownFields.includes(state.error) ? reason : `${reason} ${texts.chooseAgain}`;
}
