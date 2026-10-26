import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col text-black font-sans z-0">
      <div className="absolute inset-0 bg-[#F4F5F7] -z-20"></div>
      <div className="absolute inset-0 bg-[url('/images/background.png')] bg-cover bg-no-repeat bg-center opacity-10 -z-10 pointer-events-none"></div>
      
      {/* გასწორებული Header */}
      <header className="w-full bg-[#FE017E] text-white py-[22px] px-8 flex items-center shadow-md">
        <div className="flex items-center gap-4">
          
          {/* ლოგოს იმიტაცია (სქრინის მიხედვით V-ფორმის ხაზები) */}
          <div className="w-20 h-20 flex items-center justify-center cursor-pointer">
            <img 
              src="https://btu.edu.ge/wp-content/uploads/2021/03/logo_w-1.png"
              alt="BTU Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          
          {/* ტექსტი ორ ხაზზე */}
          <div className="flex flex-col justify-center cursor-default">
            <div className="text-[33px] leading-none mb-[3px] flex items-center">
              <span className="font-extrabold tracking-wide">AI SKILLS</span>
            </div>
            <div className="text-300 text-[30px] font-light tracking-[0.08em] leading-none mt-1">
              DIGITAL PASSPORT
            </div>
          </div>

        </div>
      </header>

      {/* მთავარი კონტენტი */}
      <main className="flex-1 w-full max-w-[1000px] mx-auto pt-0 pb-12 px-6 flex flex-col justify-center mt-[80px]">
        <div className="relative bg-white/[0.83] w-full rounded-[24px] shadow-md p-12">
          {/* 1. LATEST AI SKILLSET */}
          <img 
            src="/images/latest-skillset.png" 
            alt="Latest AI Skillset" 
            className="hidden lg:block absolute -top-2 -left-20 w-[220px] -rotate-[20deg] drop-shadow-lg z-10 pointer-events-none" 
          />

          {/* 2. ISSUED BY... */}
          <img 
            src="/images/issued-by.png" 
            alt="Issued by" 
            className="hidden lg:block absolute top-[33%] -left-[120px] w-[200px] -rotate-12 drop-shadow-lg z-10 pointer-events-none" 
          />

          {/* 3. მწვანე ბეჭედი */}
          <img 
            src="/images/green-stamp.png" 
            alt="Green Stamp" 
            className="hidden lg:block absolute -bottom-[50px] -left-20 w-[130px] -rotate-[15deg] drop-shadow-lg z-10 pointer-events-none" 
          />

          {/* 4. BLOCKCHAIN VERIFIED (შუა მარჯვენა - მარჯვნივ დახრილი) */}
          <img 
            src="/images/blockchain.png" 
            alt="Blockchain Verified" 
            className="hidden lg:block absolute top-[30%] -right-20 w-[180px] rotate-6 drop-shadow-lg z-10 pointer-events-none" 
          />

          {/* 5. ლურჯი სამკუთხედი (ქვედა მარჯვენა - უფრო მეტად მარჯვნივ დახრილი) */}
          <img 
            src="/images/blue-triangle.png" 
            alt="AI Skills Digital Passport" 
            className="hidden lg:block absolute bottom-12 -right-20 w-[160px] rotate-12 drop-shadow-lg z-10 pointer-events-none" 
          />

          
          <div className="flex flex-col md:flex-row border-b border-gray-200 pb-12">
            <div className="flex-1 flex flex-col items-center justify-center border-r border-gray-200 px-6">
              <h2 className="text-[23px] font-extrabold mb-4 text-black">საკუთარი პასპორტის მიღება</h2>
              <div className="w-full max-w-[350px]">
                <label className="block text-[15px] font-semibold text-gray-400 mb-2">შეიყვანეთ BTU-ს მეილი</label>
                <input 
                  type="email" 
                  placeholder="example@btu.edu.ge" 
                  className="w-full border border-gray-300 rounded-lg px-4 h-[48px] outline-none focus:border-[#FE017E] focus:ring-1 focus:ring-[#FE017E] transition-all text-md"
                />
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-6 mt-10 md:mt-0">
              <h2 className="text-[23px] font-extrabold mb-8 text-black">პასპორტის ვერიფიკაცია</h2>
              <Link 
                href="/verify" 
                className="bg-[#FE017E] hover:bg-[#FE017E] hover:scale-105 transition-all duration-300 ease-in-out text-white text-[20px] font-bold h-[60px] px-16 rounded-lg flex items-center justify-center shadow-sm"
              >
                გადასვლა
              </Link>
            </div>
          </div>

          <div className="pt-12 px-4">
            <h2 className="text-[28px] font-black text-center mb-10 text-black">რა არის AI SKILLS DIGITAL PASSPORT</h2>
            
            {/* წავშალეთ grid და დავტოვეთ ერთიანი ბლოკი */}
            <div className="text-[15px] text-gray-500 font-medium space-y-5 leading-[1.8] text-justify block">
              
              {/* სურათის კონტეინერი ჩავსვით პარაგრაფებამდე. 
                  დავამატეთ: float-right (მარჯვნივ გასაწევად), w-1/2 (ეკრანის ნახევარი რომ დაიკავოს) და ml-6 mb-4 (ტექსტისგან დასაშორებლად) */}
              <div className="float-right w-full sm:w-1/2 md:w-5/12 ml-6 mb-4 bg-[#F8F9FA] rounded-xl border-[4px] border-[#2C2D30] overflow-hidden relative">
                <Image 
                  src="/images/passport.png" 
                  alt="AI Skills Passport" 
                  width={600} 
                  height={400} 
                  className="w-full h-auto object-cover" 
                />
              </div>

              {/* ტექსტები ბუნებრივად შემოეხვევა სურათს */}
              <p><b>Lorem ipsum </b> dolor sit amet, consectetur adipiscing elit. Nam metus ipsum, consequat sed consectetur ut, commodo non velit. Nulla ultricies quam ipsum, a pulvinar diam porttitor at. Maecenas suscipit facilisis risus, et semper ex dignissim nec.</p>
              <p>Aenean sed convallis ac, posuere ut neque. Aliquam elementum varius elit quis rutrum. Ut vel commodo odio. Aenean pretium laoreet ipsum, eu pretium est egestas in.</p>
              <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam metus ipsum, consequat sed consectetur ut, commodo non velit. Nulla ultricies quam ipsum, a pulvinar diam porttitor at. Maecenas suscipit facilisis risus, et semper ex dignissim nec.</p>
              <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam metus ipsum, consequat sed consectetur ut, commodo non velit. Nulla ultricies quam ipsum, a pulvinar diam porttitor at. Maecenas suscipit facilisis risus, et semper ex dignissim nec.</p>
              
              {/* ეს ეხმარება კონტეინერს, რომ float ელემენტის გამო სიმაღლეში არ აირიოს */}
              <div className="clear-both"></div>
            </div>
          </div>

        </div>
      </main>

      <footer className="w-full bg-[#1A1A1C] py-12 px-6 mt-16">
        <div className="w-full max-w-[1000px] mx-auto flex flex-col md:flex-row items-center md:items-start gap-8">
          
          {/* ლოგო გარე ლინკით */}
          <div className="w-[180px] shrink-0">
            <img 
              src="https://btu.edu.ge/wp-content/uploads/2021/07/logo_w-300x193.png" 
              alt="BTU Logo" 
              className="w-full h-auto object-contain"
            />
          </div>

          {/* საკონტაქტო ინფორმაცია */}
          <div className="flex flex-col justify-center text-[#8C8D90] text-[14px] leading-snug md:border-l md:border-[#333333] md:pl-8 text-center md:text-left">
            <p>თბილისი 0179</p>
            <p>საქართველო ი.ჭავჭავაძის გამზირი N82</p>
            <p>(+995 32) 2 195 015</p>
          </div>
          
        </div>
      </footer>
    </div>
  );
}