import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F4F5F7] flex flex-col text-black font-sans">
      
      {/* გასწორებული Header */}
      <header className="w-full bg-black text-white py-[18px] px-8 flex items-center shadow-md">
        <div className="flex items-center gap-4">
          
          {/* ლოგოს იმიტაცია (სქრინის მიხედვით V-ფორმის ხაზები) */}
          <div className="w-17 h-17 flex items-center justify-center">
            <img 
              src="https://btu.edu.ge/wp-content/uploads/2021/03/logo_w-1.png"
              alt="BTU Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          
          {/* ტექსტი ორ ხაზზე */}
          <div className="flex flex-col justify-center">
            <div className="text-[30px] leading-none mb-[4px] flex items-center">
              <span className="font-extrabold tracking-wide">AI SKILLS</span>
            </div>
            <div className="text-300 text-[25px] font-light tracking-[0.18em] leading-none mt-1">
              DIGITAL PASSPORT
            </div>
          </div>

        </div>
      </header>

      {/* მთავარი კონტენტი */}
      <main className="flex-1 w-full max-w-[1000px] mx-auto py-12 px-6 flex flex-col justify-center">
        <div className="bg-white w-full rounded-[24px] shadow-sm p-12">
          
          <div className="flex flex-col md:flex-row border-b border-gray-200 pb-12">
            <div className="flex-1 flex flex-col items-center justify-center border-r border-gray-200 px-6">
              <h2 className="text-[20px] font-extrabold mb-8 text-black">საკუთარი პასპორტის მიღება</h2>
              <div className="w-full max-w-[320px]">
                <label className="block text-[13px] font-semibold text-gray-400 mb-2">შეიყვანეთ BTU-ს მეილი</label>
                <input 
                  type="email" 
                  placeholder="example@btu.edu.ge" 
                  className="w-full border border-gray-300 rounded-lg px-4 h-[48px] outline-none focus:border-[#FF8200] focus:ring-1 focus:ring-[#FF8200] transition-all text-sm"
                />
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-6 mt-10 md:mt-0">
              <h2 className="text-[20px] font-extrabold mb-8 text-black">პასპორტის ვერიფიკაცია</h2>
              <Link 
                href="/verify" 
                className="bg-[#FF8200] hover:bg-[#e67500] text-white text-[15px] font-bold h-[48px] px-16 rounded-lg transition-colors flex items-center justify-center shadow-sm"
              >
                გადასვლა
              </Link>
            </div>
          </div>

          <div className="pt-12 px-4">
            <h2 className="text-[24px] font-black text-center mb-10 text-black">რა არის AI SKILLS DIGITAL PASSPORT</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="text-[13px] text-gray-500 font-medium space-y-5 leading-[1.8] text-justify">
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam metus ipsum, consequat sed consectetur ut, commodo non velit. Nulla ultricies quam ipsum, a pulvinar diam porttitor at. Maecenas suscipit facilisis risus, et semper ex dignissim nec.</p>
                <p>Aenean sed convallis ac, posuere ut neque. Aliquam elementum varius elit quis rutrum. Ut vel commodo odio. Aenean pretium laoreet ipsum, eu pretium est egestas in.</p>
              </div>
              <div className="bg-[#F8F9FA] rounded-xl border-[4px] border-[#2C2D30] overflow-hidden relative flex items-center justify-center min-h-[220px]">
                <Image 
                  src="/passport.png" 
                  alt="AI Skills Passport" 
                  width={600} 
                  height={400} 
                  className="w-full h-full object-cover" 
                />
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}