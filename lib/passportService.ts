import { registerPassportOnChain } from '@/lib/blockchain';
import { isPassportEligibleStatus, isPassportInput, type PassportRegistration } from '@/lib/passportTypes';
import crypto from 'crypto';

type PassportWorkflowResult =
  | { success: false; error: string }
  | { success: true; data: PassportRegistration };

export function preparePassportRegistration(
  body: unknown,
  pdfBuffer: Buffer,
  registration: Pick<PassportRegistration, 'passportId' | 'version' | 'prevVerificationId'> & { verificationId: string },
): PassportWorkflowResult {
  if (!isPassportInput(body)) {
    return { success: false, error: "აუცილებელი ველები არასრულყოფილია" };
  }
  if (!isPassportEligibleStatus(body.status)) {
    return { success: false, error: "მხოლოდ CONFIRMED უნარი შეიძლება დაემატოს პასპორტს" };
  }

  const docHashHex = "0x" + crypto.createHash('sha256').update(pdfBuffer).digest('hex');

  const passportRecord: PassportRegistration = {
    ...registration,
    docHashHex,
  };

  return { success: true, data: passportRecord };
}

export async function registerPassportVersionOnChain(record: PassportRegistration): Promise<string> {
  return registerPassportOnChain(
    record.passportId,
    record.verificationId,
    record.docHashHex,
    record.version,
    record.prevVerificationId,
  );
}