"use client";

import { useActionState, useId, useState } from "react";
import { VersionField } from "@/app/_actions/form-parts";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { LOGO_LIMITS } from "@/photo/browser";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { removeLogoAction, uploadLogoAction } from "./logo-actions";
import { LOGO_FIELD, type RemoveLogoState, type UploadLogoState } from "./logo-form-input";

const { logo: texts } = teamMessages.museumSettings;

type LogoFormProps = { version: number; hasLogo: boolean };

/**
 * The form „Logo“ of the museum settings (ST-102): the upload – „Logo hochladen“ without a logo, „Logo ersetzen“ with one –
 * and, only while there is a logo (G11), „Logo entfernen“ in one tap without a question (G10c). The chosen file is posted
 * as it is – a native file field, no photo preparation in the browser, so a logo keeps its format and transparency; it
 * works without JavaScript.
 */
export function LogoForm(props: LogoFormProps) {
  const [uploadState, upload, uploading] = useActionState(uploadLogoAction, null);
  const [removeState, remove, removing] = useActionState(removeLogoAction, null);
  return (
    <LogoFormContent
      {...props}
      uploadState={uploadState}
      removeState={removeState}
      upload={upload}
      remove={remove}
      pending={uploading || removing}
    />
  );
}

/**
 * The form as it looks in an action state. Nothing typed is kept: the file chooser shows itself empty after a rejection,
 * and the rejections are about the image itself or a change made meanwhile, so none asks to choose the image again (G8a).
 */
export function LogoFormContent({
  version,
  hasLogo,
  uploadState,
  removeState,
  upload,
  remove,
  pending = false,
}: LogoFormProps & {
  uploadState: UploadLogoState;
  removeState: RemoveLogoState;
  upload?: (formData: FormData) => void;
  remove?: (formData: FormData) => void;
  pending?: boolean;
}) {
  const rejectionId = useId();
  /** The browser's own check of the size (with JavaScript) – the server checks again. */
  const [tooLarge, setTooLarge] = useState(false);
  const rejection = tooLarge
    ? commandErrorText(teamMessages, "logo-too-large")
    : uploadState && commandErrorText(teamMessages, uploadState.error);
  const imageInvalid = tooLarge || (!!uploadState && uploadState.error !== "version-conflict");

  return (
    <div className="flex flex-col gap-4">
      <form action={upload} className="flex flex-col gap-4">
        <VersionField version={version} />
        <Field data-invalid={imageInvalid}>
          <FieldLabel htmlFor="logo">{texts.image}</FieldLabel>
          <Input
            id="logo"
            name={LOGO_FIELD}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
            onChange={(event) => {
              const file = event.target.files?.[0];
              const over = !!file && file.size > LOGO_LIMITS.maxUploadBytes;
              setTooLarge(over);
              if (over) event.target.value = "";
            }}
            aria-invalid={imageInvalid || undefined}
            aria-describedby={rejection ? `${rejectionId} logo-hint` : "logo-hint"}
          />
          <FieldDescription id="logo-hint">{texts.hint}</FieldDescription>
        </Field>
        {rejection && (
          <div id={rejectionId}>
            <Rejection>{rejection}</Rejection>
          </div>
        )}
        <Button type="submit" disabled={pending}>
          {hasLogo ? texts.replace : texts.upload}
        </Button>
      </form>
      {hasLogo && (
        <form action={remove} className="flex flex-col gap-2">
          <VersionField version={version} />
          {removeState && <Rejection>{commandErrorText(teamMessages, removeState.error)}</Rejection>}
          <Button type="submit" variant="outline" className="self-start" disabled={pending}>
            {texts.remove}
          </Button>
        </form>
      )}
    </div>
  );
}
