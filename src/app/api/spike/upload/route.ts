import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { hasSpikeAccess } from "@/spike/access";

/** ST-001 spike: issues short-lived presigned upload URLs; the file goes from the browser straight to Blob. */
const MAX_BYTES = 110 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as HandleUploadPresignedBody;
    const json = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => {
        if (!(await hasSpikeAccess())) throw new Error("Not authorized");
        if (!pathname.startsWith("spike/")) throw new Error("Invalid pathname");
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          maximumSizeInBytes: MAX_BYTES,
          validUntil: Date.now() + 15 * 60 * 1000,
        });
        return {
          token,
          urlOptions: { maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true, allowOverwrite: false },
        };
      },
    });
    return NextResponse.json(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: message === "Not authorized" ? 401 : 400 });
  }
}
