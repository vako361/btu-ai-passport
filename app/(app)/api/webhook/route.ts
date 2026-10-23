import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { processPassportWorkflow } from '../../../../lib/passportService';
import { generatePassportPDF } from '../../../../lib/pdfGenerator';

// 📌 მომავალში გამოსაყენებელი ფუნქციები (ახლა დაკომენტარებულია)
// import { getStudentFromDB, updateStudentInDB } from '../../../../lib/dbService';
// import { uploadPDFToStorage } from '../../../../lib/storageService';

export async function POST(request: Request) {
  try {
    // 1. ვიღებთ 1 ახალ უნარს Webhook-იდან (შეიცავს სტუდენტის პირად ინფორმაციასაც)
    const newSkill = await request.json(); 
    const studentId = newSkill["Student ID"];
    console.log('✅ Webhook მიღებულია, ვიწყებთ დამუშავებას...');

    // ---------------------------------------------------------
    // 2. 📌 (მომავალში) ბაზიდან წამოვიდოდა ძველი უნარები:
    // const studentProfile = await getStudentFromDB(studentId);
    // const existingSkills = studentProfile ? studentProfile.skills : [];
    
    // 🔹 სატესტო მონაცემები (Mock Data): ვითომ ბაზამ დაგვიბრუნა ეს 2 ძველი უნარი
    const existingSkills = [
      { "Skill Name": "AI Literacy", "Date Earned": "2026-09-18" },
      { "Skill Name": "Prompt Engineering Fundamentals", "Date Earned": "2026-09-21" }
    ];
    // ---------------------------------------------------------

    // 3. ვაერთიანებთ ძველ უნარებს და ახლად მიღებულ უნარს სრულ სიაში
    const allSkills = [...existingSkills, newSkill];

    // 4. ვქმნით ახალ ვერიფიკაციის კოდს ამ კონკრეტული ვერსიისთვის
    const verificationId = `VER-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // 5. ვაგენერირებთ PDF-ს
    // newSkill -> გადავცემთ, რომ ყდაზე სტუდენტის სახელი და გვარი წაიკითხოს
    // allSkills -> გადავცემთ, რომ მე-4 გვერდზე ცხრილი სრულად შეავსოს
    const pdfBuffer = await generatePassportPDF(newSkill, allSkills, verificationId);

    // ---------------------------------------------------------
    // 6. 📌 (მომავალში) ორიგინალი ფაილის ატვირთვა საცავში (AWS/Payload Media)
    // const pdfUrl = await uploadPDFToStorage(pdfBuffer, verificationId);
    
    // 🔹 სატესტო შენახვა: ვინახავთ ლოკალურად public ფოლდერში, რომ თვალით ვნახოთ
    const testPdfPath = path.join(process.cwd(), 'public', 'test-passport.pdf');
    fs.writeFileSync(testPdfPath, pdfBuffer);
    console.log('📄 სატესტო PDF ფაილი შენახულია public ფოლდერში');
    // ---------------------------------------------------------

    // 7. 📌 (მომავალში) ბაზის განახლება გაზრდილი სრული სიით და ფაილის ლინკით
    // await updateStudentInDB(studentId, allSkills, pdfUrl);

    // 8. ვგზავნით მონაცემებს და ფაილის ბუფერს ბლოკჩეინის ლოგიკის ძრავში
    // (აქ newSkill-ს ვატანთ, რადგან ტრანზაქცია ამ 1 კონკრეტულ განახლებას ეხება)
    const result = await processPassportWorkflow(newSkill, pdfBuffer, verificationId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'პასპორტი შეიქმნა (სატესტო რეჟიმში) და ჩაიწერა',
      txHash: result.txHash,
      // fileUrl: pdfUrl // 📌 (მომავალში) ვაბრუნებთ გადმოსაწერ ლინკსაც
    }, { status: 200 });
    
  } catch (error) {
    console.error('❌ შეცდომა:', error);
    return NextResponse.json({ success: false, details: String(error) }, { status: 500 });
  }
}