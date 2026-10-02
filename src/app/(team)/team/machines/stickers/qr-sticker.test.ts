import jsQR from "jsqr";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
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
});
