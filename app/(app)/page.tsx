import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col text-black font-sans z-0">
      
      {/* უხილავი მთავარი სათაური SEO-სა და წამკითხველებისთვის */}
      <h1 className="sr-only">BTU AI Skills Digital Passport - მთავარი გვერდი</h1>

      <div className="absolute inset-0 bg-[#F4F5F7] -z-20"></div>
      <div className="absolute inset-0 bg-[url('/images/background.png')] bg-cover bg-no-repeat bg-center opacity-10 -z-10 pointer-events-none"></div>
      
      {/* გასწორებული Header */}
      <header className="w-full bg-[#FE017E] text-white py-5.5 px-8 flex items-center shadow-md">
        <div className="flex items-center gap-4">
          
          <Link href="/" className="relative w-20 h-20 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
            <Image 
              src="https://btu.edu.ge/wp-content/uploads/2021/03/logo_w-1.png"
              alt="BTU Logo" 
              fill
              unoptimized
              className="object-contain"
            />
          </Link>
          
          <div className="flex flex-col justify-center cursor-default">
            <div className="text-[33px] leading-none mb-0.75 flex items-center">
              <span className="font-extrabold tracking-wide">AI SKILLS</span>
            </div>
            <div className="text-[30px] font-light tracking-[0.08em] leading-none mt-1">
              DIGITAL PASSPORT
            </div>
          </div>

        </div>
      </header>

      {/* მთავარი კონტენტი */}
      <main className="flex-1 w-full max-w-250 mx-auto pt-0 pb-12 px-6 flex flex-col justify-center mt-20">
        <div className="relative bg-white/83 backdrop-blur-sm w-full rounded-3xl shadow-md p-6 sm:p-12">
          
          {/* დეკორატიული სტიკერები (alt="" screen reader-ებისთვის იგნორირებისთვის) */}
          <Image src="/images/latest-skillset.png" alt="" width={220} height={150} className="hidden lg:block absolute -top-2 -left-20 w-55 -rotate-12 drop-shadow-lg z-10 pointer-events-none" />
          <Image src="/images/issued-by.png" alt="" width={200} height={150} className="hidden lg:block absolute top-[33%] -left-28 w-50 -rotate-12 drop-shadow-lg z-10 pointer-events-none" />
          <Image src="/images/green-stamp.png" alt="" width={130} height={130} className="hidden lg:block absolute -bottom-12 -left-20 w-32.5 -rotate-12 drop-shadow-lg z-10 pointer-events-none" />
          <Image src="/images/blockchain.png" alt="" width={180} height={150} className="hidden lg:block absolute top-[30%] -right-20 w-45 rotate-6 drop-shadow-lg z-10 pointer-events-none" />
          <Image src="/images/blue-triangle.png" alt="" width={160} height={120} className="hidden lg:block absolute bottom-12 -right-20 w-40 rotate-12 drop-shadow-lg z-10 pointer-events-none" />

          {/* მოთხოვნის და ვერიფიკაციის სექცია */}
          <div className="flex flex-col md:flex-row border-b border-gray-200 pb-12 gap-8 md:gap-0">
            
            {/* პასპორტის მოთხოვნა ფორმით */}
            <div className="flex-1 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-200 px-2 sm:px-6 pb-8 md:pb-0">
              <h2 className="text-[23px] font-extrabold mb-3 text-black text-center">საკუთარი პასპორტი</h2>
              <p className="mb-5 max-w-87.5 text-center text-sm leading-relaxed text-gray-600">შედით BTU-ის ელფოსტით, რომ ნახოთ და ჩამოტვირთოთ თქვენი უახლესი ვერსია.</p>
              <Link href="/student" className="flex h-12 w-full max-w-87.5 items-center justify-center rounded-lg bg-[#FE017E] px-6 font-bold text-white shadow-sm transition-colors hover:bg-[#d6006a]">
                სტუდენტის შესვლა
              </Link>
            </div>

            {/* ვერიფიკაციაზე გადასვლა */}
            <div className="flex-1 flex flex-col items-center justify-center px-2 sm:px-6 pt-4 md:pt-0">
              <h2 className="text-[23px] font-extrabold mb-6 md:mb-8 text-black text-center">პასპორტის ვერიფიკაცია</h2>
              <Link 
                href="/verify" 
                className="bg-[#FE017E] hover:bg-[#d6006a] hover:scale-105 transition-all duration-300 ease-in-out text-white text-[20px] font-bold h-15 px-16 rounded-lg flex items-center justify-center shadow-sm w-full max-w-70"
              >
                გადასვლა
              </Link>
            </div>
          </div>

          {/* ახსნა-განმარტებითი ტექსტი */}
          <div className="pt-12 px-2 sm:px-4">
            <h2 className="text-[24px] sm:text-[28px] font-black text-center mb-10 text-black">რა არის AI SKILLS DIGITAL PASSPORT</h2>
            
            <div className="text-[15px] text-gray-600 font-medium space-y-5 leading-[1.8] text-justify block">
              
              <div className="float-none sm:float-right w-full sm:w-1/2 md:w-5/12 ml-0 sm:ml-6 mb-6 bg-[#F8F9FA] rounded-xl border-4 border-[#2C2D30] overflow-hidden relative">
                <Image 
                  src="/images/passport.png" 
                  alt="AI Skills Passport Preview" 
                  width={600} 
                  height={400} 
                  className="w-full h-auto object-cover" 
                />
              </div>

              <p><b>AI Skills Digital Passport</b> არის ბიზნესისა და ტექნოლოგიების უნივერსიტეტის (BTU) მიერ შექმნილი ინოვაციური პლატფორმა, რომელიც სტუდენტებს საშუალებას აძლევს, ერთ სივრცეში შეაგროვონ და ციფრულად დაადასტურონ ხელოვნურ ინტელექტთან დაკავშირებული თავიანთი უნარები და მიღწევები.</p>
              <p>ციფრული პასპორტი აღრიცხავს თითოეულ წარმატებით გავლილ ტრენინგს, ვორქშოფსა თუ ჰაკათონს. მონაცემები ინახება უსაფრთხოდ, რაც სრულად გამორიცხავს გაყალბების რისკს და დამსაქმებელს აძლევს სანდო ინფორმაციას სტუდენტის კვალიფიკაციის შესახებ.</p>
              <p>ვერიფიკაციის სისტემის საშუალებით, ნებისმიერ დაინტერესებულ პირს (მაგალითად, დამსაქმებელს ან პარტნიორ ორგანიზაციას) შეუძლია მარტივად შეამოწმოს პასპორტის ნამდვილობა უნიკალური ID კოდის შეყვანით ან თავად ციფრული დოკუმენტის (PDF) ატვირთვით ჩვენს სისტემაში.</p>
              <p>ეს ინიციატივა მიზნად ისახავს ხელი შეუწყოს სტუდენტების ტექნოლოგიურ განვითარებას და გაუმარტივოს მათ შრომის ბაზარზე თავიანთი კონკურენტული უპირატესობის დემონსტრირება.</p>
              
              <div className="clear-both"></div>
            </div>
          </div>

        </div>
      </main>

      <footer className="w-full bg-[#1A1A1C] py-12 px-6 mt-16">
        <div className="w-full max-w-250 mx-auto flex flex-col md:flex-row items-center md:items-start gap-8">
          
          <div className="relative w-45 h-28.75 shrink-0">
            <Image 
              src="https://btu.edu.ge/wp-content/uploads/2021/07/logo_w-300x193.png" 
              alt="BTU Logo" 
              fill
              unoptimized
              className="object-contain"
            />
          </div>

          <div className="flex flex-col justify-center text-[#8C8D90] text-[14px] leading-snug md:border-l md:border-[#333333] md:pl-8 text-center md:text-left h-full pt-4">
            <p>თბილისი 0179</p>
            <p>საქართველო ი.ჭავჭავაძის გამზირი N82</p>
            <p>(+995 32) 2 195 015</p>
          </div>
          
        </div>
      </footer>
    </div>
  );
}