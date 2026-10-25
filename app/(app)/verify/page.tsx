'use client';

import { useState } from 'react';

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
      <main className="flex-1 w-full max-w-[850px] mx-auto py-12 px-6 flex flex-col justify-center">
        <div className="bg-white w-full rounded-[24px] shadow-sm px-10 py-14 flex flex-col items-center">
          
          <div className="text-center mb-10">
            <h2 className="text-[26px] font-black text-black">პასპორტის ვერიფიკაცია</h2>
            <h3 className="text-[18px] font-extrabold text-[#FF8200] mt-2">ატვირთეთ პასპორტის PDF</h3>
          </div>

          <div className="flex flex-col items-center w-full max-w-[550px]">
            
            <label className="w-full bg-[#FAF9F6] border border-[#EBEBEB] rounded-2xl h-[220px] flex flex-col items-center justify-center cursor-pointer hover:bg-[#F3F1EC] transition-all mb-8 relative group">
              {loading && !verificationId ? (
                <span className="text-[#FF8200] font-bold">მიმდინარეობს შემოწმება...</span>
              ) : (
                <>
                  <svg className="w-9 h-9 text-black mb-3 group-hover:-translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="text-gray-400 text-sm font-semibold">{file ? file.name : ""}</span>
                </>
              )}
              <input type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} disabled={loading} />
            </label>

            <p className="text-[#FF8200] font-bold text-[14px] mb-8 text-center">
              ან ჩაწერეთ ვერიფიკაციის კოდი არსებობის დასადგენად
            </p>

            <form onSubmit={handleIdSubmit} className="flex w-full gap-4 mb-4">
              <div className="flex-1">
                <input 
                  type="text" 
                  placeholder="მაგ: VER12345"
                  value={verificationId}
                  onChange={(e) => { setVerificationId(e.target.value); setFile(null); }}
                  className="w-full border border-gray-300 rounded-lg px-4 h-[48px] text-[14px] outline-none focus:border-[#FF8200] focus:ring-1 focus:ring-[#FF8200] transition-all font-semibold"
                  disabled={loading}
                />
              </div>
              <div className="flex items-end">
                <button 
                  type="submit" 
                  disabled={loading || !verificationId}
                  className="bg-[#FF8200] hover:bg-[#e67500] disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-[15px] font-bold h-[48px] px-8 rounded-lg transition-all"
                >
                  {loading && verificationId ? 'მოწმდება...' : 'შემოწმება'}
                </button>
              </div>
            </form>

            {result && (
              <div className={`w-full mt-6 p-4 rounded-xl border text-center ${result.success ? 'bg-[#F0FDF4] border-[#BBF7D0]' : 'bg-[#FEF2F2] border-[#FECACA]'}`}>
                {result.success ? (
                  <>
                    {result.type === "FILE_VERIFIED" ? (
                      <h3 className="text-green-700 font-bold text-lg">✅ დოკუმენტი 100%-ით ნამდვილია და უცვლელი!</h3>
                    ) : (
                      <h3 className="text-blue-700 font-bold text-lg">ℹ️ ოფიციალური ჩანაწერი მოიძებნა!</h3>
                    )}
                    <p className="text-sm mt-2 text-gray-600">პასპორტის ID: {result.data.passportId}</p>
                    <p className="text-sm text-gray-600">ვერსია: {result.data.version} {result.data.isLatest ? "(უახლესი)" : "(ძველი ვერსია)"}</p>
                  </>
                ) : (
                  <h3 className="text-red-700 font-bold text-lg">❌ {result.error || "ვერიფიკაცია ვერ მოხერხდა."}</h3>
                )}
              </div>
            )}
            
          </div>
        </div>
      </main>
    </div>
  );
}