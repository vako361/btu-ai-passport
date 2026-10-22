import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyDocumentOnChain } from '@/lib/blockchain';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    const file = formData.get('file') as File | null;
    const verificationId = formData.get('verificationId') as string | null;

    // სცენარი A: გადმოიგზავნა PDF ფაილი
    if (file) {
      console.log(`📄 ვამოწმებთ ფაილს: ${file.name}`);
      
      // 1. ფაილის წაკითხვა და ბუფერად ქცევა
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // 2. SHA-256 ჰეშის დათვლა ზუსტად ისე, როგორც შექმნისას
      const docHashHex = "0x" + crypto.createHash('sha256').update(buffer).digest('hex');
      
      // 3. ბლოკჩეინზე გადამოწმება (ვატანთ ჰეშს და isHash = true)
      const onChainData = await verifyDocumentOnChain(docHashHex, true);
      
      return NextResponse.json({ success: true, data: onChainData });
    }

    // სცენარი B: გადმოიგზავნა ტექსტური ID
    if (verificationId) {
      console.log(`🔍 ვამოწმებთ ID-ს: ${verificationId}`);
      
      // ბლოკჩეინზე გადამოწმება (ვატანთ ID-ს და isHash = false)
      const onChainData = await verifyDocumentOnChain(verificationId, false);
      
      return NextResponse.json({ success: true, data: onChainData });
    }

    return NextResponse.json(
      { success: false, error: "ფაილი ან ID არ არის მოწოდებული" },
      { status: 400 }
    );

  } catch (error) {
    console.error('❌ შეცდომა ვერიფიკაციისას:', error);
    return NextResponse.json({ success: false, details: String(error) }, { status: 500 });
  }
}