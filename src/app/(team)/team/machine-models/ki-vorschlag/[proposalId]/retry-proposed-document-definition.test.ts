import { describe, expect, it } from "vitest";
import { retryProposedDocumentInput } from "./retry-proposed-document-definition";

describe("what „Nochmal versuchen“ posts", () => {
  it("reads the place and the version as whole numbers", () => {
    expect(retryProposedDocumentInput({ aiModelProposalId: "p", index: "2", version: "7" })).toEqual({
      aiModelProposalId: "p",
      index: 2,
      version: 7,
    });
  });

  it("turns anything else into a place or a version nobody saw", () => {
    expect(retryProposedDocumentInput({ aiModelProposalId: "p", index: "x", version: "1.5" })).toEqual({
      aiModelProposalId: "p",
      index: -1,
      version: -1,
    });
    expect(
      retryProposedDocumentInput({ aiModelProposalId: undefined, index: undefined, version: undefined }),
    ).toMatchObject({ aiModelProposalId: "", index: -1, version: -1 });
  });
});
