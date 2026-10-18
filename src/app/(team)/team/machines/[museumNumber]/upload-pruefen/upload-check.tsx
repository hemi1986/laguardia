"use client";

import { useState } from "react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Confirmation, Rejection } from "@/components/ui/message";
import { uploadFile, type UploadError } from "@/upload/browser";
import { storedContentAction } from "./actions";

type Texts = {
  file: string;
  maximumSize: string;
  maximumSizeHint: string;
  progress: string;
  uploaded: string;
  storedSize: string;
  open: string;
  errors: Record<UploadError, string>;
};

type Outcome =
  | { state: "uploading"; percent: number }
  | { state: "uploaded"; name: string; storeAddress: string; size?: number; viewAddress?: string }
  | { state: "failed"; error: UploadError };

/** Uploads the chosen file straight to the private store as soon as it is chosen, and shows how it went (ST-085). */
export function UploadCheck({ machineId, texts }: { machineId: string; texts: Texts }) {
  const [maximumSize, setMaximumSize] = useState("");
  const [outcome, setOutcome] = useState<Outcome | undefined>();

  async function upload(file: File | undefined) {
    if (!file) return;
    setOutcome({ state: "uploading", percent: 0 });
    const uploaded = await uploadFile(file, {
      owner: { machineId },
      maximumSize: maximumSize ? Number(maximumSize) : undefined,
      onProgress: (percent) => setOutcome({ state: "uploading", percent }),
    });
    if (!uploaded.ok) return setOutcome({ state: "failed", error: uploaded.error });
    const stored = await storedContentAction(uploaded.name);
    setOutcome({ state: "uploaded", name: uploaded.name, storeAddress: uploaded.storeAddress, ...stored });
  }

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="maximum-size">{texts.maximumSize}</FieldLabel>
        <Input
          id="maximum-size"
          type="number"
          min={1}
          inputMode="numeric"
          value={maximumSize}
          onChange={(event) => setMaximumSize(event.target.value)}
          aria-describedby="maximum-size-hint"
        />
        <FieldDescription id="maximum-size-hint">{texts.maximumSizeHint}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="file">{texts.file}</FieldLabel>
        <Input id="file" type="file" onChange={(event) => void upload(event.target.files?.[0])} />
      </Field>
      {outcome?.state === "uploading" && (
        <p role="status">{texts.progress.replace("{percent}", String(outcome.percent))}</p>
      )}
      {outcome?.state === "failed" && <Rejection>{texts.errors[outcome.error]}</Rejection>}
      {outcome?.state === "uploaded" && (
        <div className="flex flex-col gap-2" data-store-address={outcome.storeAddress}>
          <Confirmation>{texts.uploaded}</Confirmation>
          <p className="text-sm break-all">{outcome.name}</p>
          {outcome.size !== undefined && (
            <p className="text-sm">{texts.storedSize.replace("{size}", String(outcome.size))}</p>
          )}
          {outcome.viewAddress && (
            <a href={outcome.viewAddress} className="self-start text-sm underline underline-offset-4">
              {texts.open}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
