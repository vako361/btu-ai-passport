This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Google Sheets Integration

The `Verified Skills` sheet must have these headers: `Record ID`, `Student ID`, `Skill Code`, `Date Earned`, and `Status`. Status values are `CONFIRMED`, `PENDING`, or `REJECTED`; only `CONFIRMED` records start passport issuance.

1. Configure `DATABASE_URL`, `PAYLOAD_SECRET`, `BLOCKCHAIN_RPC_URL`, `ISSUER_PRIVATE_KEY`, `NEXT_PUBLIC_CONTRACT_ADDRESS`, and a random `SHEETS_WEBHOOK_SECRET` of at least 32 characters in the server environment.
2. Apply the Payload migrations to the intended database with `npx payload migrate`, then seed the `Students` and `Skills` collections from the approved test data.
3. Copy `scripts/google-sheets-webhook.gs` into the spreadsheet's Apps Script project. In Script Properties, set `SHEETS_WEBHOOK_URL` to the deployed `/api/webhook` URL and `SHEETS_WEBHOOK_SECRET` to the same shared secret used by the server.
4. Run `installVerifiedSkillsTrigger` once and approve the requested spreadsheet/external-request permissions.

The trigger signs the exact JSON body and timestamp with HMAC-SHA256. The endpoint rejects stale or invalid signatures, validates each row, and uses `Record ID` for idempotency. `PENDING` and `REJECTED` rows are recorded as skipped. Integration outcomes are available in Payload's `Integration Logs` collection; raw request bodies are not stored.

Passport PDFs are encrypted with AES-256-GCM and stored outside `public/` in `PASSPORT_STORAGE_DIR` (defaults to `storage/passports`). Set `PASSPORT_STORAGE_KEY` to a persistent 32-byte hex key, for example generate one with `openssl rand -hex 32`. Mount the storage directory on a persistent private volume in production. Students download their own issued versions from `/api/passports/{verificationId}` after signing in with the same email as their Student record.

Student accounts are provisioned by an administrator; public self-registration is disabled. Set `BTU_EMAIL_DOMAIN` (defaults to `btu.edu.ge`) and `PAYLOAD_ADMIN_EMAIL` to the administrator's BTU address. Set `PAYLOAD_ADMIN_PASSWORD` securely, then run `npm run bootstrap:admin`; the script creates the configured BTU administrator only if that account does not exist and never resets an existing password. The student account email must match the email in the `Students` collection. Public verification additionally requires `BLOCKCHAIN_RPC_URL`, `NEXT_PUBLIC_CONTRACT_ADDRESS`, and a trusted server-only `BTU_ISSUER_ADDRESS`; without the last value the UI reports issuer authenticity as not configured and does not claim BTU issuance.

Set `BTU_ISSUER_ADDRESS` to the address that owns the deployed `PassportVerifier` contract, and provision that value through a trusted BTU deployment process. The public verifier compares this configured identity to the on-chain contract owner. Missing blockchain or issuer configuration is an unavailable/unconfigured verification state, never a successful BTU issuer check.

Public verification reports four independent results: whether the Verification ID exists on-chain, whether an uploaded PDF hash matches the record, whether the configured BTU issuer matches the contract owner, and whether the version is latest or superseded. ID-only checks do not claim PDF integrity. Public responses do not reveal the student's name, email, or Passport ID.

Do not commit environment secrets or use real student data in the hackathon test environment. Confirm the database target and take a backup before applying migrations.
