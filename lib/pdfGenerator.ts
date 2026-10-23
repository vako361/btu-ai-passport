import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

export async function generatePassportPDF(
  studentData: any,      // პასუხისმგებელია სტუდენტის პირად ინფორმაციაზე
  allSkills: any[],      // პასუხისმგებელია დაგროვებული უნარების სიაზე
  verificationId: string // უნიკალური ვერიფიკაციის კოდი
): Promise<Buffer> {

  // 1. ვკითხულობთ 4-გვერდიან ცარიელ შაბლონს public ფოლდერიდან
  const templatePath = path.join(process.cwd(), 'public', 'passport-template.pdf');
  const existingPdfBytes = await fs.readFile(templatePath);
  
  // 2. ვტვირთავთ შაბლონს pdf-lib-ში
  const pdfDoc = await PDFDocument.load(existingPdfBytes);

  // 3. ვიყენებთ სტანდარტულ ინგლისურ ფონტებს
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // 4. ვიღებთ ოთხივე გვერდს (დარწმუნდი, რომ შაბლონს 4 გვერდი აქვს)
  const pages = pdfDoc.getPages();
  const page1 = pages[0]; // ყდა
  const page4 = pages[3]; // დეტალური ცხრილის გვერდი

  // -------------------------------------------------------------
  // ეტაპი A: პირველი გვერდის (ყდის) შევსება
  // -------------------------------------------------------------
  const firstName = studentData["First Name"] || "";
  const lastName = studentData["Last Name"] || "";

  page1.drawText(firstName, {
    x: 100, 
    y: 600, // y კოორდინატი შეცვალე რეალური დიზაინის მიხედვით
    size: 24, 
    font: boldFont, 
    color: rgb(0, 0, 0) 
  });

  page1.drawText(lastName, {
    x: 100, 
    y: 560, 
    size: 24, 
    font: boldFont, 
    color: rgb(0, 0, 0) 
  });

  // -------------------------------------------------------------
  // ეტაპი B: Passport ID-ის დაწერა ოთხივე გვერდზე
  // -------------------------------------------------------------
  for (const page of pages) {
    if (page) {
      page.drawText(`VERIFICATION ID: ${verificationId}`, { 
        x: 400, // დიზაინის მიხედვით დაარეგულირე x და y
        y: 50,  
        size: 12, 
        font: regularFont,
        color: rgb(0.4, 0.4, 0.4)
      });
    }
  }

  // -------------------------------------------------------------
  // ეტაპი C: მე-4 გვერდის (უნარების ცხრილის) შევსება დინამიურად
  // -------------------------------------------------------------
  let currentY = 500; // საიდან იწყება ცხრილის პირველი ხაზი

  page4.drawText('VERIFIED AI SKILLS', { x: 50, y: 550, size: 18, font: boldFont });

  // forEach ციკლი ჩამოუყვება ყველა ძველ და ახალ უნარს და ჩაწერს მე-4 გვერდზე
  allSkills.forEach((skill, index) => {
    const skillName = skill["Skill Name"] || "Unknown Skill";
    const dateEarned = skill["Date Earned"] || "N/A";

    page4.drawText(`${index + 1}. ${skillName} | Date: ${dateEarned}`, {
      x: 50,
      y: currentY,
      size: 12,
      font: regularFont,
      color: rgb(0.2, 0.2, 0.2)
    });

    currentY -= 30; // ყოველ შემდეგ უნარზე ტექსტი 30 პიქსელით ქვემოთ დაიწერება
  });

  // 5. ვინახავთ და ვაბრუნებთ დასრულებულ PDF ფაილს (ბლოკჩეინისთვის)
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}