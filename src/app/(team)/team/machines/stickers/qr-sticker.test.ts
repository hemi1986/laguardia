import jsQR from "jsqr";
import { PNG } from "pngjs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { L7160, StickerSheet } from "./sticker-sheet";
import { qrCodeImage } from "./qr-sticker";

/** The QR sticker (ST-011): what the printed code says, read back the way a phone camera would. */
function decoded(dataUrl: string): string | undefined {
  const png = PNG.sync.read(Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"));
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data;
}

describe("the QR sticker", () => {
  it("ST-011: The QR code contains the stable address", async () => {
    const image = await qrCodeImage("LG-042");

    expect(decoded(image)).toBe("https://eschbach.michaelschempp.de/m/LG-042");
  });

  it("ST-011: Technician prints a QR sticker", async () => {
    const html = renderToStaticMarkup(
      createElement(StickerSheet, { sheet: L7160, stickers: [{ museumNumber: "LG-042", qrCode: await qrCodeImage("LG-042") }] }),
    );

    expect(html).toMatch(/<img[^>]+src="data:image\/png;base64,[^"]+"[^>]*alt="QR-Code LG-042"/);
    expect(html).toContain(">LG-042<");
    expect(html).toContain("Problem? Scan mich!");
    expect(html).toContain("Problem? Scan me!");
  });

  it("ST-011: Technician prints stickers for several machines on one label sheet", async () => {
    const stickers = await Promise.all(
      ["LG-042", "LG-043", "LG-044"].map(async (museumNumber) => ({ museumNumber, qrCode: await qrCodeImage(museumNumber) })),
    );

    const html = renderToStaticMarkup(createElement(StickerSheet, { sheet: L7160, stickers }));

    // One A4 page; L7160: 3 × 7 labels of 63.5 × 38.1 mm, 7.2 mm from the left, 15.15 mm from the top, 66.04 mm apart.
    expect(html.match(/class="sticker-page"/g)).toHaveLength(1);
    const positions = [...html.matchAll(/left:([\d.]+)mm;top:([\d.]+)mm;width:63.5mm;height:38.1mm/g)].map(
      ([, left, top]) => [Number(left), Number(top)],
    );
    expect(positions).toEqual([
      [7.2, 15.15],
      [73.24, 15.15],
      [139.28, 15.15],
    ]);
    for (const museumNumber of ["LG-042", "LG-043", "LG-044"]) expect(html).toContain(`>${museumNumber}<`);
  });

  it("starts a second A4 page after 21 stickers", async () => {
    const qrCode = await qrCodeImage("LG-001");
    const stickers = Array.from({ length: 22 }, (_, i) => ({ museumNumber: `LG-${String(i + 1).padStart(3, "0")}`, qrCode }));

    const html = renderToStaticMarkup(createElement(StickerSheet, { sheet: L7160, stickers }));

    expect(html.match(/class="sticker-page"/g)).toHaveLength(2);
  });
});
