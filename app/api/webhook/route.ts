import { NextResponse } from 'next/server';
import { processPassportWorkflow } from '../../../lib/passportService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('✅ Webhook მიღებულია, ვიწყებთ დამუშავებას...');

    // 1. PDF-ის გენერაცია
    // მომავალში აქ იქნება: const pdfBuffer = await generatePDF(body);
    // დროებით ვქმნით ყალბ "ფაილს" ტექსტისგან, რათა ტესტირება შევძლოთ:
    const tempPdfBuffer = Buffer.from(`ეს არის დროებითი PDF ფაილი სტუდენტისთვის: ${body["First Name"]}`);

    // 2. გადავცემთ body-ს და შექმნილ pdfBuffer-ს ჩვენს ლოგიკის ძრავს
    const result = await processPassportWorkflow(body, tempPdfBuffer);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'პასპორტი შეიქმნა და ჩაიწერა ბლოკჩეინზე',
        data: result.data,
        transactionHash: result.txHash 
      },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('❌ კრიტიკული შეცდომა:', error);
    return NextResponse.json({ success: false, details: String(error) }, { status: 500 });
  }
}