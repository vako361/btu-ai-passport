import type { Metadata } from 'next';
import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { IssuedToast } from '@/components/IssuedToast';
import { LinkPending } from '@/components/LinkPending';
import { formatDate, formatDateTime } from '@/lib/format';
import { getLedger } from '@/lib/ledger';
import { getRequestPayload } from '@/lib/payloadClient';
import { isValidVerificationId, normalizeVerificationId, verifyCredential, type PublicVerification } from '@/lib/verification';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ verificationId: string }>; searchParams: Promise<{ issued?: string }> };

export async function generateMetadata({ params }: Pick<Params, 'params'>): Promise<Metadata> {
  const { verificationId } = await params;
  return {
    title: `Verify ${normalizeVerificationId(verificationId)} | AI Skills Digital Passport`,
    robots: { index: false },
  };
}

type Outcome = { kind: 'result'; result: PublicVerification } | { kind: 'unavailable' } | { kind: 'invalid' };

async function check(rawVerificationId: string): Promise<Outcome> {
  if (!isValidVerificationId(rawVerificationId)) return { kind: 'invalid' };

  try {
    const payload = await getRequestPayload();
    return { kind: 'result', result: await verifyCredential(payload, getLedger(payload), rawVerificationId) };
  } catch (error) {
    console.error('Verification page could not reach the ledger', error);
    return { kind: 'unavailable' };
  }
}

function Banner({ tone, title, children }: { tone: 'valid' | 'caution' | 'invalid'; title: string; children: React.ReactNode }) {
  const styles = {
    valid: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    caution: 'border-amber-200 bg-amber-50 text-amber-900',
    invalid: 'border-red-200 bg-red-50 text-red-900',
  }[tone];
  const icon = { valid: '✓', caution: '!', invalid: '✕' }[tone];
  const iconStyles = { valid: 'bg-emerald-500', caution: 'bg-amber-500', invalid: 'bg-red-500' }[tone];

  return (
    <div role="status" className={`flex items-start gap-4 rounded-2xl border p-5 sm:p-6 ${styles}`}>
      <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-black text-white ${iconStyles}`}>
        {icon}
      </span>
      <div>
        <h1 className="text-xl font-extrabold">{title}</h1>
        <p className="mt-1 text-sm leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{label}</dt>
      <dd className="mt-1 break-all text-sm font-bold text-gray-900">{children}</dd>
    </div>
  );
}

function NotFound({ verificationId, reason }: { verificationId: string; reason: 'missing' | 'invalid' | 'unavailable' }) {
  const copy = {
    missing: ['No credential found', 'There is no credential registered under this Verification ID. Check the code and try again.'],
    invalid: ['Invalid Verification ID', 'Verification IDs look like VER-XXXXXXXXXXXXXXXXXXXXXXXX. Check the code and try again.'],
    unavailable: ['Verification is temporarily unavailable', 'We could not reach the credential ledger. Please try again in a moment.'],
  }[reason];

  return (
    <>
      <Banner tone={reason === 'unavailable' ? 'caution' : 'invalid'} title={copy[0]}>{copy[1]}</Banner>
      <p className="mt-4 break-all font-mono text-xs text-gray-500">{verificationId}</p>
      <Link href="/verify" className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-[#FE017E] px-6 text-sm font-bold text-white hover:bg-[#d6006a]">
        Try another code
        <LinkPending className="h-4 w-4" />
      </Link>
    </>
  );
}

export default async function VerifyCredentialPage({ params, searchParams }: Params) {
  const { verificationId: rawVerificationId } = await params;
  const { issued } = await searchParams;
  const outcome = await check(rawVerificationId);
  const verificationId = normalizeVerificationId(rawVerificationId);

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F5F7] text-gray-900">
      <AppHeader subtitle="Credential verification" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        {outcome.kind === 'invalid' ? <NotFound verificationId={verificationId} reason="invalid" /> : null}
        {outcome.kind === 'unavailable' ? <NotFound verificationId={verificationId} reason="unavailable" /> : null}

        {outcome.kind === 'result' && !outcome.result.recordExists ? (
          <NotFound verificationId={verificationId} reason="missing" />
        ) : null}

        {outcome.kind === 'result' && outcome.result.recordExists ? <Verified result={outcome.result} justIssued={issued === '1'} /> : null}
      </main>
    </div>
  );
}

function Verified({ result, justIssued }: { result: PublicVerification; justIssued: boolean }) {
  const { credential, ledger } = result;
  const authentic = result.issuerAuthenticity === 'VERIFIED';

  return (
    <div className="space-y-6">
      {justIssued && authentic ? <IssuedToast /> : null}
      {authentic ? (
        <Banner tone="valid" title={justIssued ? 'Credential issued and verified' : 'Credential verified'}>
          This credential was registered by the issuer and its record is intact.
          {result.latestStatus === 'SUPERSEDED' ? ' A newer version of this passport has since been issued.' : ''}
        </Banner>
      ) : (
        <Banner tone="caution" title="Record found, issuer not confirmed">
          {result.issuerAuthenticity === 'NOT_CONFIGURED'
            ? 'A record exists, but this deployment has no trusted issuer configured to confirm it.'
            : 'A record exists, but it could not be confirmed as issued by the expected authority.'}
        </Banner>
      )}

      {credential ? (
        <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-100 sm:p-8">
          <div className="-mx-6 -mt-6 mb-6 h-1.5 bg-[#FE017E] sm:-mx-8 sm:-mt-8" />
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Passport holder</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">{credential.holderName}</h2>

          <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Fact label="Passport ID">{credential.passportId}</Fact>
            <Fact label="Version">V{credential.version}{result.latestStatus === 'LATEST' ? ' (latest)' : ' (superseded)'}</Fact>
            <Fact label="Issued">{formatDate(credential.issuedAt)}</Fact>
          </dl>

          <h3 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wider text-gray-500">Verified skills</h3>
          <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
            {credential.skills.map((skill) => (
              <li key={`${skill.skillCode}-${skill.earnedAt}`} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold">{skill.skillName}</p>
                  {skill.description ? <p className="text-sm text-gray-500">{skill.description}</p> : null}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="rounded-md bg-gray-100 px-2 py-1 font-mono">{skill.skillCode}</span>
                  <span>{formatDate(skill.earnedAt)}</span>
                </div>
              </li>
            ))}
          </ul>

          <a
            href={`${credential.downloadPath}?download=1`}
            className="mt-8 inline-flex h-12 items-center rounded-xl bg-[#FE017E] px-7 text-sm font-bold text-white shadow-lg shadow-pink-500/20 hover:bg-[#d6006a]"
          >
            Download certificate (PDF)
          </a>
        </section>
      ) : (
        <p className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
          Holder details are not shown because the stored credential could not be matched to its ledger record.
        </p>
      )}

      <section className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">Ledger record</h3>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Fact label="Ledger">{ledger.label}</Fact>
          <Fact label="Registered">{formatDateTime(ledger.registeredAt)}</Fact>
          <div className="sm:col-span-2">
            <Fact label="Verification ID">{result.verificationId}</Fact>
          </div>
          {ledger.transactionHash ? (
            <div className="sm:col-span-2">
              <Fact label="Record hash">
                <span className="font-mono text-xs font-medium">{ledger.transactionHash}</span>
                {ledger.transactionUrl ? (
                  <a href={ledger.transactionUrl} className="ml-2 text-xs font-bold text-[#FE017E] hover:underline" rel="noopener noreferrer" target="_blank">
                    View on explorer
                  </a>
                ) : null}
              </Fact>
            </div>
          ) : null}
        </dl>
        {ledger.mode === 'demo' ? (
          <p className="mt-4 text-xs text-gray-500">
            This deployment runs in demo mode: the ledger is a signed, hash-chained record kept in the application database,
            not a public blockchain.
          </p>
        ) : null}
        <p className="mt-4 text-sm text-gray-600">
          Have the original PDF?{' '}
          <Link href="/verify" className="font-bold text-[#FE017E] hover:underline">Upload it</Link> to confirm it has not been altered.
        </p>
      </section>
    </div>
  );
}
