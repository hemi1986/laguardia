# `AI_SETTINGS_ENCRYPTION_KEY` – one-time setup per environment

The museum's OpenRouter API key is entered by a technician on „Einstellungen“ → „KI“ and stored in the database **only
encrypted** (AES-256-GCM, `docs/adr/0014-ai-through-openrouter-with-a-multimodal-index-in-postgresql.md`, ST-104). The
key that encrypts it comes from the environment variable `AI_SETTINGS_ENCRYPTION_KEY`: 32 random bytes, base64. Each
environment has its own, so a database backup or a Neon preview branch copied from production carries only ciphertext
that the preview cannot decrypt. About 5 minutes.

## Create it

```sh
openssl rand -base64 32
```

One value per environment – never the same value twice:

| Environment | Where |
|---|---|
| Local (`npm run dev`) | `.env.development.local` (`AI_SETTINGS_ENCRYPTION_KEY=…`, see `.env.example`) |
| Local browser tests | nothing to do – `scripts/e2e-server.ts` sets a fixed key for its throwaway database |
| Previews | Vercel → Project → Settings → Environment Variables, environment **Preview**, type **Sensitive** |
| Production | the same, environment **Production**, type **Sensitive** – a value of its own |

Redeploy after adding it on Vercel; environment variables reach a deployment only when it is built.

## When it is missing or changed

- **Missing:** a technician cannot save a key – the save fails with a server error (nothing is saved). Everything else
  works; AI stays off.
- **Changed or lost:** the saved OpenRouter key can no longer be decrypted. It then counts as no key: AI is off and the
  form „KI“ asks for the key again. Nothing else is lost – the chosen models and the AI index stay. A technician enters
  the key again (with ST-110, „Ersetzen“; before that, it is entered like a first key).
- Never put the value in a chat, a ticket or a commit. It is not a password anyone types – it lives only in the
  environment.

## Rotating it

There is no re-encryption. Set a new value, redeploy, and have a technician enter the OpenRouter key again.
