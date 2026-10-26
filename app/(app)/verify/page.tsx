'use client';

import { useState } from 'react';
import Link from 'next/link'; // დამატებულია Link

export default function VerifyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [verificationId, setVerificationId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runVerification = async (formData: FormData) => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/verify', { method: 'POST', body: formData });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("შეცდომა კავშირისას:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const formData = new FormData();
      formData.append('file', selectedFile);
      runVerification(formData);
    }
  };

  const handleIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationId) return;
    const formData = new FormData();
    formData.append('verificationId', verificationId);
    runVerification(formData);
  };

  const closeModal = () => {
    setResult(null);
  };

  return (
    <div className="relative min-h-screen flex flex-col text-black font-sans z-0">
      
      {/* ფონი */}
      <div className="absolute inset-0 bg-[#F4F5F7] -z-20"></div>
      <div className="absolute inset-0 bg-[url('/images/background.png')] bg-cover bg-no-repeat bg-center opacity-10 -z-10 pointer-events-none"></div>
      
      {/* Header */}
      <header className="w-full bg-[#FE017E] text-white py-[22px] px-8 flex items-center shadow-md">
        <div className="flex items-center gap-4">
          
          {/* შეცვლილი ლოგო: ახლა უკვე Link-ია და აბრუნებს მთავარ გვერდზე */}
          <Link href="/" className="w-20 h-20 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
            <img 
              src="https://btu.edu.ge/wp-content/uploads/2021/03/logo_w-1.png"
              alt="BTU Logo" 
              className="w-full h-full object-contain"
            />
          </Link>
          
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
      <main className="flex-1 w-full max-w-[1000px] mx-auto pt-8 pb-12 px-6 flex flex-col justify-center mt-[40px]">
        
        {/* აქ დაემატა backdrop-blur-md ფონის დასაბლარად */}
        <div className="relative bg-white/[0.7] backdrop-blur-[2px] w-full rounded-[24px] shadow-md px-10 py-16 flex flex-col items-center">
          
          {/* სტიკერები */}
          <img src="/images/latest-skillset.png" alt="Latest AI Skillset" className="hidden lg:block absolute -top-0 -left-12 w-[220px] -rotate-[15deg] drop-shadow-lg z-10 pointer-events-none" />
          <img src="/images/issued-by.png" alt="Issued by" className="hidden lg:block absolute top-[50%] -left-[100px] w-[200px] -rotate-12 drop-shadow-lg z-10 pointer-events-none" />
          <img src="/images/blue-triangle.png" alt="AI Skills Digital Passport" className="hidden lg:block absolute top-[25%] -right-16 w-[160px] rotate-12 drop-shadow-lg z-10 pointer-events-none" />
          <img src="/images/blockchain.png" alt="Blockchain Verified" className="hidden lg:block absolute bottom-12 -right-30 w-[180px] -rotate-6 drop-shadow-lg z-10 pointer-events-none" />

          {/* სათაური */}
          <div className="text-center mb-8">
            <h2 className="text-[28px] font-black text-black">პასპორტის ვერიფიკაცია</h2>
            <h3 className="text-[18px] font-extrabold text-[#FE017E] mt-2">მარტივი ვერიფიკაცია კოდით</h3>
          </div>

          <div className="flex flex-col items-center w-full max-w-[700px] z-20">
            
            {/* 1. კოდით შემოწმების ფორმა */}
            <form onSubmit={handleIdSubmit} className="flex flex-col md:flex-row w-full gap-4 mb-12 items-end">
              <div className="flex-1 w-full">
                <label className="block text-[14px] font-semibold text-gray-500 mb-2">შეიყვანეთ ვერიფიკაციის კოდი</label>
                <input 
                  type="text" 
                  placeholder="მაგ: VER12345"
                  value={verificationId}
                  onChange={(e) => { setVerificationId(e.target.value); setFile(null); }}
                  className="w-full border border-gray-200 rounded-lg px-4 h-[48px] text-[15px] outline-none focus:border-[#FE017E] focus:ring-1 focus:ring-[#FE017E] transition-all font-medium bg-white"
                  disabled={loading}
                />
              </div>
              <div className="flex w-full md:w-auto">
                <button 
                  type="submit" 
                  disabled={loading || !verificationId}
                  className="w-full md:w-auto bg-[#FE017E] cursor-pointer hover:bg-[#d6006a] hover:scale-105 disabled:bg-gray-300 disabled:hover:scale-100 disabled:cursor-not-allowed text-white text-[16px] font-bold h-[48px] px-10 rounded-lg transition-all duration-300 flex items-center justify-center shadow-sm"
                >
                  {loading && verificationId ? 'მოწმდება...' : 'შემოწმება'}
                </button>
              </div>
            </form>

            {/* 2. PDF ატვირთვის სექცია */}
            <div className="w-full text-center border-t border-gray-100 pt-10">
              <h3 className="text-[18px] font-extrabold text-[#FE017E] mb-6">ან ატვირთეთ PDF სრული ვერიფიკაციისთვის</h3>
              
              <label className="w-full bg-[#FCF2F6]/60 hover:bg-[#FCF2F6] border-[2px] border-dashed border-[#FAD1E3] rounded-2xl h-[240px] flex flex-col items-center justify-center cursor-pointer transition-all relative group shadow-sm">
                {loading && !verificationId ? (
                  <span className="text-[#FE017E] font-bold text-lg">მიმდინარეობს შემოწმება...</span>
                ) : (
                  <>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2C2D30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-4 group-hover:-translate-y-2 transition-transform duration-300">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    <span className="text-gray-500 text-[15px] font-semibold">
                      {file ? file.name : "დააკლიკეთ ან ჩააგდეთ PDF ფაილი"}
                    </span>
                  </>
                )}
                <input type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} disabled={loading} />
              </label>
            </div>
            
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-[#1A1A1C] py-12 px-6 mt-auto">
        <div className="w-full max-w-[1000px] mx-auto flex flex-col md:flex-row items-center md:items-start gap-8">
          <div className="w-[180px] shrink-0">
            <img 
              src="https://btu.edu.ge/wp-content/uploads/2021/07/logo_w-300x193.png" 
              alt="BTU Logo" 
              className="w-full h-auto object-contain"
            />
          </div>
          <div className="flex flex-col justify-center text-[#8C8D90] text-[14px] leading-snug md:border-l md:border-[#333333] md:pl-8 text-center md:text-left">
            <p>თბილისი 0179</p>
            <p>საქართველო ი.ჭავჭავაძის გამზირი N82</p>
            <p>(+995 32) 2 195 015</p>
          </div>
        </div>
      </footer>

      {/* Modal - შედეგის ფანჯარა */}
      {result && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-[2px] transition-opacity">
          <div className="bg-white rounded-[24px] p-8 max-w-[450px] w-full relative shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in duration-200">
            
            {/* დახურვის ღილაკი (X) + cursor-pointer */}
            <button 
              onClick={closeModal}
              className="absolute top-5 right-5 text-gray-400 hover:text-black transition-colors cursor-pointer"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            {/* Modal-ის კონტენტი */}
            {result.success ? (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <h3 className="text-black font-extrabold text-[22px] mb-2">ვერიფიკაცია წარმატებულია</h3>
                
                {result.type === "FILE_VERIFIED" ? (
                  <p className="text-green-600 font-semibold mb-6">დოკუმენტი ნამდვილია და უცვლელი!</p>
                ) : (
                  <p className="text-blue-600 font-semibold mb-6">ოფიციალური ჩანაწერი მოიძებნა!</p>
                )}
                
                <div className="w-full bg-gray-50 rounded-xl p-4 text-left border border-gray-100">
                  <p className="text-sm text-gray-500 mb-1">პასპორტის ID:</p>
                  <p className="text-black font-bold mb-3">{result.data?.passportId || "უცნობია"}</p>
                  
                  <p className="text-sm text-gray-500 mb-1">ვერსია:</p>
                  <p className="text-black font-bold">
                    {result.data?.version || "-"} 
                    <span className={result.data?.isLatest ? "text-green-600 ml-2" : "text-amber-500 ml-2"}>
                      {result.data?.isLatest ? "(უახლესი)" : "(ძველი ვერსია)"}
                    </span>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </div>
                <h3 className="text-black font-extrabold text-[22px] mb-2">ვერიფიკაცია ვერ მოხერხდა</h3>
                <p className="text-gray-600 mb-6">{result.error || "მონაცემები არ მოიძებნა ან ფაილი არასწორია."}</p>
              </>
            )}
            
            {/* "დახურვა" ღილაკი + cursor-pointer */}
            <button 
              onClick={closeModal}
              className="mt-6 w-full bg-gray-100 hover:bg-gray-200 text-black font-bold py-3 rounded-xl transition-colors cursor-pointer"
            >
              დახურვა
            </button>

          </div>
        </div>
      )}
      
    </div>
  );
}