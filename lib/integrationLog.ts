import type { Payload } from 'payload';

type IntegrationLogInput = {
  requestId: string;
  recordId?: string;
  stage: 'AUTHENTICATION' | 'VALIDATION' | 'LOOKUP' | 'INGESTION';
  outcome: 'ACCEPTED' | 'DUPLICATE' | 'SKIPPED' | 'REJECTED' | 'FAILED';
  message: string;
};

export async function writeIntegrationLog(payload: Payload, entry: IntegrationLogInput) {
  try {
    await payload.create({
      collection: 'integration-logs',
      overrideAccess: true,
      data: {
        ...entry,
        source: 'GOOGLE_SHEETS',
        loggedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to persist Google Sheets integration log', error);
  }
}