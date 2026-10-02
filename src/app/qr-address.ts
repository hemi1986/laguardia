/**
 * The QR address of a machine (ST-060, `docs/architecture/qr-address.md`): the museum's own domain plus
 * `/m/<museum number>`. The domain is written down here and nowhere else – never taken from the request's host or
 * `VERCEL_PROJECT_PRODUCTION_URL` – because a printed sticker can never be updated. Provisional until the first
 * sticker is printed (user, 2026-10-02).
 */
export const QR_DOMAIN = "https://eschbach.michaelschempp.de";

export function qrAddress(museumNumber: string): string {
  return `${QR_DOMAIN}/m/${museumNumber}`;
}
