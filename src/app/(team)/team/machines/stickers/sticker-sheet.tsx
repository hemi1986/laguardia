import { teamMessages } from "@/platform/messages";

const { stickers: texts } = teamMessages;

/** An A4 label sheet: where each label sits, in millimetres from the page's top left corner. */
export type LabelSheet = {
  name: string;
  columns: number;
  rows: number;
  labelWidth: number;
  labelHeight: number;
  marginLeft: number;
  marginTop: number;
  pitchX: number;
  pitchY: number;
};

/**
 * Avery Zweckform L7160 (user, 2026-10-02): A4, 3 × 7 labels of 63.5 × 38.1 mm. Another label product is another
 * entry here (ST-011: the team names the product before the first print).
 */
export const L7160: LabelSheet = {
  name: "L7160",
  columns: 3,
  rows: 7,
  labelWidth: 63.5,
  labelHeight: 38.1,
  marginLeft: 7.2,
  marginTop: 15.15,
  pitchX: 66.04,
  pitchY: 38.1,
};

export type Sticker = { museumNumber: string; qrCode: string };

const mm = (value: number) => `${Math.round(value * 100) / 100}mm`;

/**
 * The printable sticker pages (ST-011): one A4 page per sheet, each sticker on its label position – QR code, museum
 * number and the prompt in German and English. Sized in millimetres for print; on screen it is a preview.
 */
export function StickerSheet({ sheet, stickers }: { sheet: LabelSheet; stickers: Sticker[] }) {
  const perPage = sheet.columns * sheet.rows;
  const pages = Array.from({ length: Math.ceil(stickers.length / perPage) }, (_, page) =>
    stickers.slice(page * perPage, (page + 1) * perPage),
  );

  return (
    <>
      {pages.map((page, pageIndex) => (
        <section key={pageIndex} className="sticker-page" style={{ position: "relative", width: "210mm", height: "297mm" }}>
          {page.map((sticker, index) => (
            <div
              key={sticker.museumNumber}
              style={{
                position: "absolute",
                left: mm(sheet.marginLeft + (index % sheet.columns) * sheet.pitchX),
                top: mm(sheet.marginTop + Math.floor(index / sheet.columns) * sheet.pitchY),
                width: mm(sheet.labelWidth),
                height: mm(sheet.labelHeight),
              }}
              className="flex items-center gap-[2mm] overflow-hidden p-[2mm]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- a data URL generated on the server, printed as is */}
              <img src={sticker.qrCode} alt={texts.qrCodeOf(sticker.museumNumber)} style={{ width: "32mm", height: "32mm" }} />
              <div className="flex flex-col gap-[1mm] text-black">
                <span className="text-[14pt] font-bold">{sticker.museumNumber}</span>
                <span lang="de" className="text-[8pt]">
                  {texts.prompt.de}
                </span>
                <span lang="en" className="text-[8pt]">
                  {texts.prompt.en}
                </span>
              </div>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}
