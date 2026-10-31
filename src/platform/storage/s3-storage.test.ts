import { describe, expect, it } from "vitest";
import { CREDENTIALS_MUST_LAST_MS, lastingCredentials } from "./s3-storage";

/**
 * The temporary credentials of the IAM role (ST-099, ADR 0012): an upload address is valid for 30 minutes, so the
 * credentials it is signed with must last longer – renewed before less than 35 minutes are left, not 5 as the SDK does.
 */
const MINUTE = 60 * 1000;

function aRole(lifetimeMs = 60 * MINUTE) {
  let time = 0;
  const assumed: number[] = [];
  const assume = async () => {
    assumed.push(time);
    return { accessKeyId: `key-${assumed.length}`, secretAccessKey: "s", expiration: new Date(time + lifetimeMs) };
  };
  return { assume, assumed, now: () => time, pass: (ms: number) => void (time += ms) };
}

describe("lasting credentials", () => {
  it("are reused while more than 35 minutes are left and renewed once less is left", async () => {
    const role = aRole();
    const credentials = lastingCredentials(role.assume, role.now);

    expect((await credentials()).accessKeyId).toBe("key-1");
    role.pass(60 * MINUTE - CREDENTIALS_MUST_LAST_MS - 1);
    expect((await credentials()).accessKeyId).toBe("key-1");
    role.pass(1);
    expect((await credentials()).accessKeyId).toBe("key-2");
    expect(role.assumed).toHaveLength(2);
  });

  it("are assumed again after a failed attempt", async () => {
    const role = aRole();
    let fail = true;
    const credentials = lastingCredentials(async () => {
      if (fail) throw new Error("STS unreachable");
      return role.assume();
    }, role.now);

    await expect(credentials()).rejects.toThrow("STS unreachable");
    fail = false;
    expect((await credentials()).accessKeyId).toBe("key-1");
  });

  it("assume the role once for calls that arrive together", async () => {
    const role = aRole();
    const credentials = lastingCredentials(role.assume, role.now);

    const all = await Promise.all([credentials(), credentials(), credentials()]);

    expect(all.map((c) => c.accessKeyId)).toEqual(["key-1", "key-1", "key-1"]);
    expect(role.assumed).toHaveLength(1);
  });

  it("tell the SDK they cache themselves, so it asks them for every signature", () => {
    expect(lastingCredentials(aRole().assume).memoized).toBe(true);
  });
});
