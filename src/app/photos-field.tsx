"use client";

import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import { PHOTO_LIMITS, PhotoTooLargeError, preparePhoto } from "@/photo/browser";
import type { PhotoFieldTexts } from "./photo-field";

type Chosen = { id: number; photo: File; preview: string };

/**
 * The optional photos of a form with several (ST-032, a work log entry's; building block ST-002): each photo taken or
 * chosen is prepared in the browser – upright, ≤ 2048 px, JPEG ≤ 600 KB so that all of them fit one request, no
 * metadata – and every prepared photo goes into the form's file field `name`, so the form still posts natively. The
 * pickers have no name: the originals never leave the phone. How many may be sent is the command's rule.
 */
export function PhotosField({
  name,
  texts,
  onPreparing,
}: {
  name: string;
  texts: PhotoFieldTexts;
  /** Tells the form photos are being prepared – it waits with sending until they are ready. */
  onPreparing: (preparing: boolean) => void;
}) {
  const field = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<Chosen[]>([]);
  const [preparing, setPreparing] = useState(0);
  const [problem, setProblem] = useState<string>();
  /** Picks still being prepared when the form is reset are dropped when they finish. */
  const generation = useRef(0);
  const nextId = useRef(0);

  useEffect(() => {
    const transfer = new DataTransfer();
    for (const { photo } of chosen) transfer.items.add(photo);
    if (field.current) field.current.files = transfer.files;
  }, [chosen]);

  useEffect(() => onPreparing(preparing > 0), [preparing, onPreparing]);

  // React resets the form after every action, which empties the file field – the previews must go with it, or they
  // would promise photos the next post does not send.
  useEffect(() => {
    const form = field.current?.form;
    const reset = () => {
      generation.current++;
      setChosen((photos) => {
        for (const { preview } of photos) URL.revokeObjectURL(preview);
        return [];
      });
      setPreparing(0);
    };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);

  async function picked(event: React.ChangeEvent<HTMLInputElement>) {
    const originals = [...(event.target.files ?? [])];
    event.target.value = ""; // the same photo can be picked again
    if (originals.length === 0) return;
    const pick = generation.current;
    setProblem(undefined);
    setPreparing((count) => count + originals.length);
    for (const original of originals) {
      try {
        const prepared = await preparePhoto(original, { maxBytes: PHOTO_LIMITS.maxPreparedBytesOfSeveral });
        if (pick !== generation.current) return;
        const photo = new File([prepared], "photo.jpg", { type: "image/jpeg" });
        setChosen((photos) => [...photos, { id: nextId.current++, photo, preview: URL.createObjectURL(photo) }]);
      } catch (failure) {
        if (pick !== generation.current) return;
        setProblem(failure instanceof PhotoTooLargeError ? texts.tooLarge : texts.notAnImage);
      } finally {
        if (pick === generation.current) setPreparing((count) => count - 1);
      }
    }
  }

  function remove(id: number) {
    setChosen((photos) =>
      photos.filter((chosenPhoto) => {
        if (chosenPhoto.id === id) URL.revokeObjectURL(chosenPhoto.preview);
        return chosenPhoto.id !== id;
      }),
    );
  }

  const picker = buttonVariants({ variant: "outline", className: "cursor-pointer" });
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-sm font-medium">{texts.label}</legend>
      <input ref={field} type="file" name={name} accept="image/jpeg" multiple hidden />
      <div className="flex flex-wrap gap-2">
        <label className={picker}>
          {texts.take}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={picked} />
        </label>
        <label className={picker}>
          {texts.choose}
          <input type="file" accept="image/*" multiple className="sr-only" onChange={picked} />
        </label>
      </div>
      {preparing > 0 && <p className="text-muted-foreground text-sm">{texts.preparing}</p>}
      {problem && <Rejection>{problem}</Rejection>}
      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {chosen.map(({ id, preview }) => (
            <li key={id} className="flex flex-col items-start gap-1">
              {/* A local object URL of the prepared photo – nothing next/image could fetch. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="" className="max-h-24 w-auto rounded-md" />
              <Button type="button" variant="outline" size="sm" onClick={() => remove(id)}>
                {texts.remove}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
