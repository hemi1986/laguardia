import { describe, expect, it } from "vitest";
import { fileMediaTypeOf } from "./file-details";

describe("the media types the file details name (ST-114)", () => {
  it.each([
    ["application/pdf", "pdf"],
    ["image/png", "png"],
    ["image/jpeg", "jpeg"],
    ["image/webp", "webp"],
    ["text/markdown", "markdown"],
    ["text/plain; charset=utf-8", "text"],
    ["video/mp4", "video"],
    ["video/quicktime", "video"],
    ["audio/mpeg", "audio"],
    ["application/zip", "other"],
    ["image/gif", "other"],
    ["", "other"],
  ])("%s reads as %s", (contentType, mediaType) => {
    expect(fileMediaTypeOf(contentType)).toBe(mediaType);
  });
});
