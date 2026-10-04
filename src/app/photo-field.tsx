"use client";

import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import { PhotoTooLargeError, preparePhoto } from "@/photo/browser";

export type PhotoFieldTexts = {
  label: string;
  take: string;
  choose: string;
  remove: string;
  preparing: string;
  /** The photo errors the browser finds itself – the same texts the server's rejections show (ST-016). */
  tooLarge: string;
  notAnImage: string;
};

/**
 * The optional photo of a report form (ST-016, building block ST-002): "take a photo" opens the camera, "choose a photo"
 * the camera or the gallery. The photo is prepared in the browser – upright, ≤ 2048 px, JPEG ≤ 1 MB, no metadata – and
 * put into the form's file field `name`, so the form still posts natively (progressive enhancement, ST-073). The two
 * pickers have no name: the original never leaves the phone. Without JavaScript no photo is sent – the report still is.
 */
export function PhotoField({
  name,
  texts,
  onPreparing,
  children,
}: {
  name: string;
  texts: PhotoFieldTexts;
  /** Tells the form a photo is being prepared – it waits with sending until it is ready. */
  onPreparing: (preparing: boolean) => void;
  /** Below the pickers, e.g. the visitor pages' privacy notice about the photo. */
  children?: React.ReactNode;
}) {
  const field = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>();
  const [preparing, setPreparing] = useState(false);
  const [problem, setProblem] = useState<string>();

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function attach(photo: File | undefined) {
    const transfer = new DataTransfer();
    if (photo) transfer.items.add(photo);
    field.current!.files = transfer.files;
    setPreview(photo && URL.createObjectURL(photo));
  }

  async function picked(event: React.ChangeEvent<HTMLInputElement>) {
    const original = event.target.files?.[0];
    event.target.value = ""; // the same photo can be picked again
    if (!original) return;
    setProblem(undefined);
    setPreparing(true);
    onPreparing(true);
    try {
      const prepared = await preparePhoto(original);
      attach(new File([prepared], "photo.jpg", { type: "image/jpeg" }));
    } catch (error) {
      attach(undefined);
      setProblem(error instanceof PhotoTooLargeError ? texts.tooLarge : texts.notAnImage);
    } finally {
      setPreparing(false);
      onPreparing(false);
    }
  }

  const picker = buttonVariants({ variant: "outline", className: "cursor-pointer" });
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-sm font-medium">{texts.label}</legend>
      <input ref={field} type="file" name={name} accept="image/jpeg" hidden />
      <div className="flex flex-wrap gap-2">
        <label className={picker}>
          {texts.take}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={picked} />
        </label>
        <label className={picker}>
          {texts.choose}
          <input type="file" accept="image/*" className="sr-only" onChange={picked} />
        </label>
      </div>
      {preparing && <p className="text-muted-foreground text-sm">{texts.preparing}</p>}
      {problem && <Rejection>{problem}</Rejection>}
      {preview && (
        <div className="flex items-end gap-3">
          {/* A local object URL of the prepared photo – nothing next/image could fetch. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="max-h-32 w-auto rounded-md" />
          <Button type="button" variant="outline" size="sm" onClick={() => attach(undefined)}>
            {texts.remove}
          </Button>
        </div>
      )}
      {children}
    </fieldset>
  );
}
