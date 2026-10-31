# AWS S3 for previews and production – one-time setup

Photos and files live in AWS S3 in `eu-central-1` (Frankfurt) on Vercel, and in SeaweedFS locally
(`docs/adr/0012-s3-compatible-object-storage.md`, ST-099). The application never creates cloud resources and no
long-lived AWS key exists: the functions assume an IAM role through Vercel's OIDC token. You set this up **once, by
hand**, in the AWS console (or the AWS CLI) and on Vercel. About 30 minutes.

Names used below – change them where AWS says a bucket name is taken (bucket names are global; **no dots**, they break
the virtual-hosted HTTPS address):

| What | Value |
|---|---|
| Vercel team (slug) | `hemi6` |
| Vercel project | `laguardia` |
| Production bucket | `laguardia-production` |
| Preview bucket (shared by all previews) | `laguardia-preview` |
| Region | `eu-central-1` |
| Production origins | `https://eschbach.michaelschempp.de`, `https://laguardia.vercel.app` (Vercel → Project → Domains) |
| Preview origin pattern | `https://laguardia-*-hemi6.vercel.app` – every deployment and branch address of a preview |

## 1. The two buckets

For each bucket (S3 → Create bucket):
1. Region **Europe (Frankfurt) eu-central-1**.
2. Object Ownership: **ACLs disabled**. **Block all public access**: on (all four).
3. Bucket Versioning: off (backups belong to the go-live planning, ADR 0012). Default encryption: SSE-S3.
4. Permissions → **CORS** – production:
   ```json
   [
     {
       "AllowedOrigins": ["https://eschbach.michaelschempp.de", "https://laguardia.vercel.app"],
       "AllowedMethods": ["GET", "PUT"],
       "AllowedHeaders": ["content-type", "if-none-match"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```
   Preview – the same, with `"AllowedOrigins": ["https://laguardia-*-hemi6.vercel.app"]` (S3 allows one `*` per origin).
   A new production domain needs a new entry here, and nothing else (the content security policy names the bucket,
   not the domain).

## 2. Vercel's OIDC identity provider in AWS

1. Vercel → Project `laguardia` → Settings → Security → **Secure backend access with OIDC federation**: enabled,
   issuer mode **Team**.
2. AWS → IAM → Identity providers → Add provider → **OpenID Connect**:
   - Provider URL: `https://oidc.vercel.com/hemi6`
   - Audience: `https://vercel.com/hemi6`

## 3. One IAM role per environment

IAM → Roles → Create role → **Web identity** → the provider above, audience `https://vercel.com/hemi6`. Then replace
the trust policy with (account ID `123456789012` as yours; `preview` instead of `production` for the preview role):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Federated": "arn:aws:iam::123456789012:oidc-provider/oidc.vercel.com/hemi6" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "oidc.vercel.com/hemi6:aud": "https://vercel.com/hemi6",
          "oidc.vercel.com/hemi6:sub": "owner:hemi6:project:laguardia:environment:production"
        }
      }
    }
  ]
}
```

Permissions – an inline policy, only its own bucket (`laguardia-preview` for the preview role):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::laguardia-production/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::laguardia-production"
    }
  ]
}
```

`s3:ListBucket` is needed although the application never lists: without it S3 answers a missing object with 403
instead of 404, and attaching could not tell "nothing uploaded" from an error.

Name the roles `laguardia-production-storage` and `laguardia-preview-storage`. Maximum session duration: **1 hour**
(the default) or more – the application renews its temporary credentials when less than 35 minutes are left, so every
30-minute upload address outlives the credentials it was signed with.

## 4. Environment variables on Vercel

Project → Settings → Environment Variables (or `vercel env add NAME <environment>`), then redeploy:

| Variable | Production | Preview |
|---|---|---|
| `S3_BUCKET` | `laguardia-production` | `laguardia-preview` |
| `S3_REGION` | `eu-central-1` | `eu-central-1` |
| `AWS_ROLE_ARN` | `arn:aws:iam::123456789012:role/laguardia-production-storage` | `arn:aws:iam::123456789012:role/laguardia-preview-storage` |

No `S3_ENDPOINT` (the regional AWS endpoint is derived) and no access keys. None of these is a secret.

## 5. Preflight check from a preview

1. Push any branch and open its preview. On a team page, open the browser's developer tools → Network.
2. Attach a file to a machine (Gerät → Datei anhängen). Expected: one `OPTIONS` and one `PUT` to
   `https://laguardia-preview.s3.eu-central-1.amazonaws.com/files/…`, both 200; no console error about the content
   security policy or CORS.
3. The same from a terminal, with the preview's address as the origin:
   ```sh
   curl -si -X OPTIONS https://laguardia-preview.s3.eu-central-1.amazonaws.com/files/check \
     -H "Origin: https://laguardia-git-main-hemi6.vercel.app" \
     -H "Access-Control-Request-Method: PUT" \
     -H "Access-Control-Request-Headers: content-type,if-none-match" | grep -i access-control-allow-origin
   ```
   Expected: `access-control-allow-origin: https://laguardia-git-main-hemi6.vercel.app`. With `-H "Origin:
   https://example.com"` no such header.
4. The browser tests on the preview (`Browser tests on preview` on the pull request) upload too – they must be green.

A request blocked by CORS or a `403 SignatureDoesNotMatch` in the function logs usually means a wrong `S3_REGION`, a
bucket name with dots, or a role whose trust policy names another environment.

## 6. After the switch

Delete the old Vercel Blob stores (development, and the one previews and production used) by hand, and remove
`BLOB_STORE_ID`, `BLOB_READ_WRITE_TOKEN` and `BLOB_WEBHOOK_PUBLIC_KEY` from Vercel and from `.env.development.local`.
The content in them is test data and is not migrated (ADR 0012).

Before real visitor data is stored: confirm the AWS DPA (part of the AWS Service Terms) – go-live planning.
