# BTU AI Skills Digital Passport

BTU AI Skills Digital Passport issues versioned, verifiable records of students' AI skills. Administrators issue credentials, students view their passport, and anyone can verify a credential by ID or by uploading its original PDF.

[Open the live demo](https://btu-ai-passport-gamma.vercel.app/)

## Features

- Role-based administrator and student accounts backed by Payload authentication.
- One-click demo sign-in with synthetic data and automatic cleanup of visitor-issued credentials.
- Versioned passport issuance with an English, four-page PDF and a public verification page.
- PDF integrity checks, issuer checks, latest-version status, and QR links to verification.
- A provider-based ledger interface: a signed Postgres hash chain for demos, or Polygon Amoy for on-chain issuance.

## Architecture

```text
Next.js App Router
  ├─ Public verification and PDF routes
  ├─ Admin dashboard and student portal
  └─ Payload CMS admin/API
		 └─ Postgres (Neon supported)
				├─ Students, skills, passports, and passport versions
				└─ Demo ledger entries

Credential issuance
  └─ Validate input → snapshot verified skills → render PDF → hash document
		 → register through LedgerProvider → expose verification ID
```

The issuance workflow lives in `lib/issuance/`. It creates immutable passport versions, renders the certificate, and registers its hash through the `LedgerProvider` contract in `lib/ledger/`. Verification uses the same provider abstraction, so application logic does not depend on a particular ledger implementation.

The default `demo` provider stores signed, hash-chained entries in Postgres. It is suitable for local development and demos, but it is not a public blockchain. Set `LEDGER_MODE=amoy` to use the Polygon Amoy provider and configure the RPC URL, contract, issuer wallet, and trusted issuer address. On-chain records cannot be automatically removed, so visitor issuance is restricted to the resettable demo ledger.

Payload collections and access rules are defined in `collections/`. Database schema changes are managed by migrations; automatic schema push is disabled.

## Run Locally

Requirements: Node.js 20.9 or later and PostgreSQL. Neon pooled connection strings are supported.

1. Install dependencies and create a local environment file:

	```bash
	npm install
	cp .env.example .env.local
	```

2. Set `DATABASE_URL`, `PAYLOAD_SECRET`, and `PASSPORT_STORAGE_KEY` in `.env.local`. Generate the two secrets with:

	```bash
	openssl rand -hex 32
	```

	Set `NEXT_PUBLIC_APP_URL` to the origin used to open the app, for example `http://localhost:3000`. This origin is embedded in PDF QR codes; keep it stable for credentials that need reproducible PDFs.

3. Apply database migrations and load the synthetic English-language dataset:

	```bash
	npm run migrate
	npm run seed
	```

4. Start the development server:

	```bash
	npm run dev
	```

Open `http://localhost:3000`. Use `npm run bootstrap:admin` to create or promote the configured administrator account.

## Demo Mode

Set these variables to enable the demo sign-in buttons and demo accounts:

```dotenv
DEMO_MODE=true
DEMO_ADMIN_PASSWORD=replace-with-a-unique-12-character-password
DEMO_STUDENT_PASSWORD=replace-with-a-unique-12-character-password
DEMO_RESET_AFTER_MINUTES=60
```

Then run `npm run seed`. The script provisions a demo administrator and student, loads reproducible synthetic records, and issues sample credentials. Demo-issued visitor credentials are removed by the scheduled cleanup and when an expired visitor starts a new session. Demo accounts are read-only in the CMS.

Never commit `.env.local` or put production credentials in demo accounts. Use unique passwords in deployed environments.

## Ledger Configuration

The demo ledger is the default:

```dotenv
LEDGER_MODE=demo
```

To issue on Polygon Amoy, deploy `contracts/PassportVerifier.sol` and configure:

```dotenv
LEDGER_MODE=amoy
BLOCKCHAIN_RPC_URL=https://your-amoy-rpc.example
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourContractAddress
ISSUER_PRIVATE_KEY=0xYourServerSideRelayerKey
BTU_ISSUER_ADDRESS=0xTrustedIssuerAddress
```

Keep `ISSUER_PRIVATE_KEY` server-side. The public verifier compares the contract's issuer with `BTU_ISSUER_ADDRESS`.

## Project Map

- `app/(app)/` - public pages, sign-in, dashboard, student portal, verification, and API routes.
- `app/(payload)/` - Payload admin interface and API routes.
- `collections/` - Payload schema and access control.
- `lib/auth/` and `lib/access.ts` - session handling and role-scoped access.
- `lib/issuance/` - credential issuance, versioning, and PDF workflow.
- `lib/ledger/` - demo and Amoy ledger providers.
- `lib/demo/` - synthetic seed data, demo accounts, and cleanup.
- `contracts/` - optional EVM verifier contract.
- `migrations/` - versioned Postgres schema changes.

## Checks

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

