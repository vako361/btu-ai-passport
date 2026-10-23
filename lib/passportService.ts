import { registerPassportOnChain } from '@/lib/blockchain';
import crypto from 'crypto';

// =====================================================================
// 1. მთავარი მენეჯერი: იღებს მონაცემებს, PDF-ის ბუფერს და verificationId-ს
// =====================================================================
export async function processPassportWorkflow(body: any, pdfBuffer: Buffer, verificationId: string) {
  // ეტაპი A: ვალიდაცია
  if (!body["Student ID"] || !body["First Name"] || !body["Skill Name"]) {
    return { success: false, error: "აუცილებელი ველები არასრულყოფილია" };
  }

  // ეტაპი B: PDF ბუფერიდან რეალური SHA-256 ჰეშის დათვლა
  // (ბლოკჩეინს სჭირდება 0x პრეფიქსი)
  const docHashHex = "0x" + crypto.createHash('sha256').update(pdfBuffer).digest('hex');

  // ეტაპი C: მონაცემების გამზადება ბლოკჩეინისთვის (ვაწვდით verificationId-საც)
  const passportRecord = preparePassportData(body, docHashHex, verificationId);

  // ეტაპი D: ბლოკჩეინზე ჩაწერა
  const txHash = await executeBlockchainTransaction(passportRecord);

  if (!txHash) {
    return { success: false, error: "ბლოკჩეინზე ტრანზაქცია ვერ შესრულდა" };
  }

  return { success: true, data: passportRecord, txHash };
}

// =====================================================================
// 2. ლოგიკა, ვერსიები და უნიკალური კოდები
// =====================================================================
function preparePassportData(body: any, docHashHex: string, verificationId: string) {
  const studentId = body["Student ID"];
  const existingPassportId = body["Passport ID (Existing)"];

  let passportId = existingPassportId; 
  let version = 1;
  let prevVerificationId = "";

  if (existingPassportId && existingPassportId.trim() !== "") {
    version = 2; 
    prevVerificationId = `OLD-VER-${studentId}`; 
  } else {
    passportId = `BTU-AI-${studentId}`;
  }

  // აქ წაიშალა randomBytes-ით ID-ის შექმნის ხაზი, რადგან ზემოდან ვიღებთ

  return { passportId, verificationId, docHashHex, version, prevVerificationId };
}

// =====================================================================
// 3. ბლოკჩეინთან კავშირი
// =====================================================================
async function executeBlockchainTransaction(record: any) {
  try {
      const txHash = await registerPassportOnChain(
        record.passportId,
        record.verificationId,
        record.docHashHex,
        record.version,
        record.prevVerificationId
      );
      console.log(`🚀 წარმატებით ჩაიწერა! Hash: ${txHash}`);
      return txHash;
  } catch (error) {
      console.error("❌ ბლოკჩეინის ერორი:", error);
      return null;
  }
}