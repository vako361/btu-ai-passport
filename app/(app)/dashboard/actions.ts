'use server';

import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { VISITOR_RECORD_PREFIX } from '@/lib/demo/config';
import { getAppEnv, EnvConfigError, getDemoEnv } from '@/lib/env';
import { issueCredential } from '@/lib/issuance/issueCredential';
import { IssuanceError } from '@/lib/issuance/types';
import { getLedger, LedgerConfigError, LedgerConflictError } from '@/lib/ledger';
import { fieldErrorsFrom } from '@/lib/validation/auth';
import { issueCredentialSchema, type IssueCredentialFieldErrors } from '@/lib/validation/issuance';

export interface IssueState {
  error?: string;
  fieldErrors?: IssueCredentialFieldErrors;
}

const MAX_VISITOR_CREDENTIALS = 25;

function friendlyError(error: unknown): string {
  if (error instanceof IssuanceError) return error.message;
  if (error instanceof LedgerConflictError) return `The ledger rejected this credential: ${error.message}`;
  if (error instanceof LedgerConfigError || error instanceof EnvConfigError) {
    return 'Credential issuing is not configured on this deployment.';
  }
  return 'The credential could not be issued. Please try again.';
}

export async function issueCredentialAction(_previous: IssueState, formData: FormData): Promise<IssueState> {
  const { user, payload } = await requireRole('admin');

  const parsed = issueCredentialSchema.safeParse({
    studentId: formData.get('studentId'),
    skillId: formData.get('skillId'),
    earnedAt: formData.get('earnedAt'),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  let verificationId: string;
  try {
    const isVisitor = user.isDemo === true && getDemoEnv().enabled;
    const ledger = getLedger(payload);

    if (isVisitor) {
      // On-chain records cannot be removed, so visitor data is only allowed on the resettable demo ledger.
      if (ledger.mode !== 'demo') {
        return { error: 'Demo issuing requires the demo ledger (LEDGER_MODE=demo).' };
      }
      const outstanding = await payload.count({
        collection: 'verified-skills',
        where: { recordId: { like: VISITOR_RECORD_PREFIX } },
        overrideAccess: true,
      });
      if (outstanding.totalDocs >= MAX_VISITOR_CREDENTIALS) {
        return { error: 'The demo has reached its credential limit. Demo data resets automatically; please try again soon.' };
      }
    }

    const issued = await issueCredential({
      payload,
      ledger,
      verifyBaseUrl: getAppEnv().appUrl,
      recordPrefix: isVisitor ? VISITOR_RECORD_PREFIX : undefined,
      input: parsed.data,
    });
    verificationId = issued.verificationId;
  } catch (error) {
    if (!(error instanceof IssuanceError)) console.error('Credential issuance failed', error);
    return { error: friendlyError(error) };
  }

  redirect(`/verify/${encodeURIComponent(verificationId)}?issued=1`);
}
