import "server-only";
import QRCode from "qrcode";
import { qrAddress } from "../../../../qr-address";

/**
 * The QR code of a machine's sticker (ST-011) as a PNG data URL – the image the sticker shows is the image a test
 * reads back. Rendered on the server: no JavaScript in the browser. Large enough to print sharply at ~30 mm.
 */
export function qrCodeImage(museumNumber: string): Promise<string> {
  return QRCode.toDataURL(qrAddress(museumNumber), { errorCorrectionLevel: "M", margin: 2, width: 480 });
}
