import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { verifyDocumentOnChain } from '@/lib/blockchain';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    const file = formData.get('file') as File | null;
    const verificationId = formData.get('verificationId') as string | null;

    // ==============================================================
    // სცენარი 1: მომხმარებელმა ატვირთა PDF ფაილი
    // ==============================================================
    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // ვერიფიკაციის კოდის ამოკითხვა მეტამონაცემებიდან
      const pdfDoc = await PDFDocument.load(buffer);
      const extractedId = pdfDoc.getSubject();

      if (!extractedId) {
        return NextResponse.json({ success: false, error: "ფაილში ვერიფიკაციის კოდი არ მოიძებნა." }, { status: 400 });
      }

      // ბლოკჩეინიდან მონაცემების წამოღება
      const onChainData = await verifyDocumentOnChain(extractedId);
      if (!onChainData.isValid) {
        return NextResponse.json({ success: false, error: "ბლოკჩეინზე დოკუმენტი არ მოიძებნა" }, { status: 404 });
      }

      // ჰეშის შედარება დოკუმენტის უცვლელობის დასადგენად
      const computedHashHex = "0x" + crypto.createHash('sha256').update(buffer).digest('hex');
      const isAuthentic = computedHashHex === onChainData.docHash;

      if (isAuthentic) {
        return NextResponse.json({ 
          success: true, 
          type: "FILE_VERIFIED",
          message: "დოკუმენტი 100%-ით ნამდვილია და უცვლელი!", 
          data: onChainData 
        });
      } else {
        return NextResponse.json({ success: false, error: "დოკუმენტი გაყალბებულია! ფაილის შინაარსი შეცვლილია." }, { status: 400 });
      }
    }

    // ==============================================================
    // სცენარი 2: მომხმარებელმა ხელით ჩაწერა Verification ID
    // ==============================================================
    if (verificationId) {
      const onChainData = await verifyDocumentOnChain(verificationId);

      if (onChainData.isValid) {
        return NextResponse.json({ 
          success: true, 
          type: "ID_FOUND",
          message: "ოფიციალური ჩანაწერი ბლოკჩეინზე მოიძებნა (თუმცა PDF-ის უცვლელობა გადამოწმებული არაა).",
          data: onChainData 
        });
      } else {
        return NextResponse.json({ success: false, error: "ბლოკჩეინზე მსგავსი ჩანაწერი არ მოიძებნა." }, { status: 404 });
      }
    }

    return NextResponse.json({ success: false, error: "არ არის მოწოდებული ფაილი ან კოდი" }, { status: 400 });

  } catch (error) {
    console.error('❌ ვერიფიკაციის ერორი:', error);
    return NextResponse.json({ success: false, error: "შიდა სერვერული შეცდომა" }, { status: 500 });
  }
}