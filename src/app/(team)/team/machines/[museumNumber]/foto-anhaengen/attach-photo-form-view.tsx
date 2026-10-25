"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { NativeSelect } from "@/components/ui/native-select";
import type { AttachTarget } from "@/modules/collection";
import { photoRejectionText } from "@/app/_actions/rejection-text";
import { keptKey } from "@/app/_actions/form-parts";
import { PhotoField, type PhotoFieldTexts } from "../../../../../photo-field";
import type { AttachPhotoState } from "./actions";
import type { AttachPhotoField } from "./attach-photo-form";

type Texts = {
  photo: PhotoFieldTexts;
  title: string;
  attachTo: string;
  choose: string;
  onlyMachine: string;
  allMachinesOfModel: string;
  submit: string;
};

type ErrorCode = NonNullable<AttachPhotoState>["error"];

/** The field that caused a rejection – marked at the form (G8); the photo's own rejections name the photo. */
const fieldOf: Partial<Record<ErrorCode, AttachPhotoField>> = {
  "title-required": "title",
  "attach-to-required": "attachTo",
};

/**
 * The form that attaches a camera photo as a file of the file category Photo (ST-054): the photo is prepared in the
 * browser (upright, downscaled, no metadata) and checked again on the server (ST-002). After a rejection the text and
 * the choices are kept, but the photo must be chosen again, and the rejection says so (G8a) – except after a rejection
 * of the photo itself, whose text already says what to do.
 */
export function AttachPhotoForm({
  action: bound,
  museumNumber,
  machineModel,
  attachTargets,
  texts,
}: {
  action: (previous: AttachPhotoState, formData: FormData) => Promise<AttachPhotoState>;
  museumNumber: string;
  machineModel: string;
  /** The targets in the order the choice offers them – from the Collection module, via the page. */
  attachTargets: readonly AttachTarget[];
  texts: Texts;
}) {
  const [state, action, pending] = useActionState(bound, null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const rejectionId = useId();
  const kept = keptKey(state);
  const invalid = state ? fieldOf[state.error] : undefined;
  const marked = (field: AttachPhotoField) => ({
    "aria-invalid": invalid === field || undefined,
    "aria-describedby": invalid === field ? rejectionId : undefined,
  });

  return (
    <form action={action} className="flex flex-col gap-5">
      <PhotoField key={`photo-${kept}`} name="photo" texts={texts.photo} onPreparing={setPreparingPhoto} />
      <Field data-invalid={invalid === "title"}>
        <FieldLabel htmlFor="title">{texts.title}</FieldLabel>
        <Input id="title" name="title" defaultValue={state?.values.title} key={`title-${kept}`} {...marked("title")} />
      </Field>
      <Field data-invalid={invalid === "attachTo"}>
        <FieldLabel htmlFor="attachTo">{texts.attachTo}</FieldLabel>
        <NativeSelect
          id="attachTo"
          name="attachTo"
          key={`attachTo-${kept}`}
          defaultValue={state?.values.attachTo ?? ""}
          {...marked("attachTo")}
        >
          <option value="">{texts.choose}</option>
          {attachTargets.map((target) => (
            <option key={target} value={target}>
              {target === "machine"
                ? texts.onlyMachine.replace("{museumNumber}", museumNumber)
                : texts.allMachinesOfModel.replace("{machineModel}", machineModel)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {state && (
        <div id={rejectionId}>
          <Rejection>{photoRejectionText(state)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending || preparingPhoto}>
        {texts.submit}
      </Button>
    </form>
  );
}
