import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * The saved OpenRouter key is kept only encrypted (ADR 0014): AES-256-GCM with the environment's
 * `AI_SETTINGS_ENCRYPTION_KEY` (32 random bytes, base64), so a backup or a preview branch carries only ciphertext. The
 * server decrypts it only to call OpenRouter. A key that cannot be decrypted – the environment key missing or changed,
 * the ciphertext changed – counts as no key (ST-104).
 */

/** The encrypted key as it is stored: `v1:<iv>:<tag>:<ciphertext>`, each part base64. */
export type EncryptedKey = string;

const VERSION = "v1";
/** The full GCM tag only – a shortened one would weaken the check (DEP0182). */
const TAG_LENGTH = 16;
/** Binds the ciphertext to what it is, so it cannot pass for another encrypted value. */
const PURPOSE = Buffer.from("ai_settings.encrypted_key:v1");

export function encryptKey(environmentKey: Buffer, key: string): EncryptedKey {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", environmentKey, iv, { authTagLength: TAG_LENGTH });
  cipher.setAAD(PURPOSE);
  const data = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

/** The key – or undefined when it cannot be decrypted with this environment key. */
export function decryptKey(environmentKey: Buffer, encrypted: EncryptedKey): string | undefined {
  const [version, iv, tag, data] = encrypted.split(":");
  if (version !== VERSION || !iv || !tag || data === undefined) return undefined;
  const authTag = Buffer.from(tag, "base64");
  if (authTag.length !== TAG_LENGTH) return undefined;
  try {
    const decipher = createDecipheriv("aes-256-gcm", environmentKey, Buffer.from(iv, "base64"), {
      authTagLength: TAG_LENGTH,
    });
    decipher.setAAD(PURPOSE);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return undefined;
  }
}

/** The environment key from its base64 text – undefined unless it is exactly 32 bytes. */
export function encryptionKeyOf(value: string | undefined): Buffer | undefined {
  if (!value) return undefined;
  const key = Buffer.from(value, "base64");
  return key.length === 32 && key.toString("base64") === value.trim() ? key : undefined;
}

/** The environment key of this deployment (`AI_SETTINGS_ENCRYPTION_KEY`, docs/operations/ai-settings-encryption-key.md). */
export function environmentEncryptionKey(): Buffer | undefined {
  return encryptionKeyOf(process.env.AI_SETTINGS_ENCRYPTION_KEY);
}
