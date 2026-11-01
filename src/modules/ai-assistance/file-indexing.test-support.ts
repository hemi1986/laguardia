import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  concatTransformationMatrix,
  drawObject,
  PDFDocument,
  popGraphicsState,
  pushGraphicsState,
  StandardFonts,
} from "pdf-lib";
import { PNG } from "pngjs";

/**
 * Files for the indexing tests (ST-106): real PDFs built with pdf-lib (its text layer drawn with a standard font, a
 * scan page as an embedded image), and PNG, JPEG and WebP images. The tests index these bytes exactly as a file in the
 * store would be read – pdfjs renders the pages, the canvas encodes the page images.
 */

/** A patterned, definitely not blank PNG. */
export function aPng(): Uint8Array {
  const png = new PNG({ width: 200, height: 100 });
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x < 200; x++) {
      const at = (y * 200 + x) * 4;
      png.data[at] = (x * 255) / 200;
      png.data[at + 1] = (y * 255) / 100;
      png.data[at + 2] = 96;
      png.data[at + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

/** The same picture as a JPEG, encoded by the canvas. */
export async function aJpeg(): Promise<Uint8Array> {
  return picture("jpeg");
}

/** The same picture as a WebP, encoded by the canvas. */
export async function aWebp(): Promise<Uint8Array> {
  return picture("webp");
}

async function picture(format: "jpeg" | "webp"): Promise<Uint8Array> {
  const image = await loadImage(aPng());
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  return canvas.encode(format, 75);
}

/** A PDF with one page of text per entry – every page has a text layer, and every page renders to a page image. */
export async function aPdfOfText(pageTexts: readonly string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const text of pageTexts) {
    const page = pdf.addPage([612, 792]);
    page.drawText(text, { x: 50, y: 700, font, size: 16, maxWidth: 500, lineHeight: 20 });
  }
  return pdf.save();
}

/**
 * The 3-page manual of scenario 1: page 1 and page 3 have a text layer, page 2 is a scan without any text (an image
 * only) – found through its page image, never through OCR.
 */
export async function aPdfWithAScanInTheMiddle(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const first = pdf.addPage([612, 792]);
  first.drawText("Page one: the flipper assembly and its coil.", { x: 50, y: 700, font, size: 16 });
  const second = pdf.addPage([612, 792]);
  second.drawImage(await pdf.embedPng(aPng()), { x: 60, y: 320, width: 420, height: 210 });
  const third = pdf.addPage([612, 792]);
  third.drawText("Page three: the bumper wiring and the switch.", { x: 50, y: 700, font, size: 16 });
  return pdf.save();
}

/**
 * A scanned page whose image cannot be decoded – a JBIG2 image with broken data. pdfjs only warns and renders the page
 * blank; it is what every JBIG2 page of a real scanned manual looked like while pdfjs could not find its decoders.
 */
export async function aPdfWithAnUndecodableScan(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const first = pdf.addPage([612, 792]);
  first.drawText("Page one: the flipper assembly and its coil.", { x: 50, y: 700, font, size: 16 });
  const second = pdf.addPage([612, 792]);
  const scan = pdf.context.register(
    pdf.context.stream(new Uint8Array(256).fill(0x5a), {
      Type: "XObject",
      Subtype: "Image",
      Width: 200,
      Height: 200,
      ColorSpace: "DeviceGray",
      BitsPerComponent: 1,
      Filter: "JBIG2Decode",
    }),
  );
  const name = second.node.newXObject("Scan", scan);
  second.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(400, 0, 0, 400, 100, 200),
    drawObject(name),
    popGraphicsState(),
  );
  return pdf.save();
}

/** Content that is not a PDF at all – a damaged file (ST-105: pdfjs fails with "Invalid PDF structure"). */
export function aDamagedPdf(): Uint8Array {
  return new TextEncoder().encode("this is no PDF – the upload was cut off");
}

/** How many pixels of an image are not near-white – a blank page image has none. */
export async function nonWhitePixels(bytes: Uint8Array): Promise<number> {
  const image = await loadImage(Buffer.from(bytes));
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let count = 0;
  for (let at = 0; at < data.length; at += 4) {
    if (data[at] < 250 || data[at + 1] < 250 || data[at + 2] < 250) count += 1;
  }
  return count;
}
