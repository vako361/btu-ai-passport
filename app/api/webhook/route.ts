import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // 1. ვკითხულობთ Google Sheets-დან გამოგზავნილ JSON მონაცემებს
    const body = await request.json();

    // 2. ვბეჭდავთ კონსოლში (ტერმინალში), რომ დავრწმუნდეთ მონაცემების მიღებაში
    console.log('✅ ახალი მონაცემი მიღებულია Webhook-დან:');
    console.log(JSON.stringify(body, null, 2));

    // 💡 (აქ მომავალში ჩაემატება PDF გენერაციისა და ბაზის გადამოწმების ლოგიკა)

    // 3. ვაბრუნებთ 200 OK სტატუსს, რომ Google Sheets-მა იცოდეს სიგნალის წარმატებით მიღების შესახებ
    return NextResponse.json(
      { success: true, message: 'Webhook წარმატებით მიღებულია' },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('❌ შეცდომა Webhook-ის დამუშავებისას:', error);
    
    // შეცდომის შემთხვევაში ვაბრუნებთ 500 სტატუსს
    return NextResponse.json(
      { success: false, message: 'შეცდომა მონაცემების მიღებისას' },
      { status: 500 }
    );
  }
}