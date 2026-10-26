'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';

// ტიპების განსაზღვრა შედეგისთვის (აშორებს any-ს)
interface VerificationResult {
  success: boolean;
  verificationId?: string;
  recordExists?: boolean;
  documentIntegrity?: 'VERIFIED' | 'FAILED' | 'NOT_CHECKED';
  issuerAuthenticity?: 'VERIFIED' | 'UNVERIFIED' | 'NOT_CONFIGURED' | 'NOT_CHECKED';
  latestStatus?: 'LATEST' | 'SUPERSEDED' | 'NOT_CHECKED' | 'UNKNOWN';
  version?: number | null;
  error?: string;
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#F4F5F7]" />}>
      <VerifyPageContent />
    </Suspense>
  );
}

function VerifyPageContent() {
  const searchParams = useSearchParams();
  const [file, setFile] = useState<File | null>(null);
  const [verificationId, setVerificationId] = useState(searchParams.get('code') || '');
  const [result, setResult] = useState<VerificationResult | null>(null);
  
  // განცალკევებული Loading მდგომარეობები
  const [loadingType, setLoadingType] = useState<'id' | 'file' | null>(null);
  
  // Drag & Drop მდგომარეობა
  const [isDragging, setIsDragging] = useState(false);

  const runVerification = async (formData: FormData, type: 'id' | 'file') => {
    setLoadingType(type);
    setResult(null);

    try {
      const response = await fetch('/api/verify', { method: 'POST', body: formData });
      
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(errorBody?.error || 'სერვერის შეცდომა');
      }
      
      const data: VerificationResult = await response.json();
      setResult(data);
    } catch (error) {
      console.error("შეცდომა კავშირისას:", error);
      // მომხმარებლისთვის შეცდომის ჩვენება catch ბლოკიდან
      setResult({
        success: false,
        error: "სერვერთან კავშირი ვერ მოხერხდა ან მონაცემები არასწორია."
      });
    } finally {
      setLoadingType(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf') {
      setResult({ success: false, error: "გთხოვთ ატვირთოთ მხოლოდ PDF ფორმატის ფაილი." });
      return;
    }
    setFile(selectedFile);
    setVerificationId(''); // ფაილის ატვირთვისას ვასუფთავებთ ID-ს
    const formData = new FormData();
    formData.append('file', selectedFile);
    runVerification(formData, 'file');
  };

  // Drag and Drop ფუნქციები
  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const handleIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationId) return;
    setFile(null); // ID-ს გაგზავნისას ვასუფთავებთ ფაილს
    const formData = new FormData();
    formData.append('verificationId', verificationId);
    runVerification(formData, 'id');
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
        
        <div className="relative bg-white/[0.7] backdrop-blur-[2px] w-full rounded-[24px] shadow-md px-10 py-16 flex flex-col items-center">
          
          {/* სტიკერები */}
          <Image src="/images/latest-skillset.png" alt="Latest AI Skillset" width={220} height={150} className="hidden lg:block absolute -top-0 -left-12 w-[220px] -rotate-12 drop-shadow-lg z-10 pointer-events-none" />
          <Image src="/images/issued-by.png" alt="Issued by" width={200} height={150} className="hidden lg:block absolute top-[50%] left-[-100px] w-[200px] -rotate-12 drop-shadow-lg z-10 pointer-events-none" />
          <Image src="/images/blue-triangle.png" alt="AI Skills Digital Passport" width={160} height={120} className="hidden lg:block absolute top-[25%] -right-16 w-[160px] rotate-12 drop-shadow-lg z-10 pointer-events-none" />
          <Image src="/images/blockchain.png" alt="Blockchain Verified" width={180} height={150} className="hidden lg:block absolute bottom-12 -right-30 w-[180px] -rotate-6 drop-shadow-lg z-10 pointer-events-none" />

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
                  disabled={loadingType !== null}
                />
              </div>
              <div className="flex w-full md:w-auto">
                <button 
                  type="submit" 
                  disabled={loadingType !== null || !verificationId}
                  className="w-full md:w-auto bg-[#FE017E] cursor-pointer hover:bg-[#d6006a] hover:scale-105 disabled:bg-gray-300 disabled:hover:scale-100 disabled:cursor-not-allowed text-white text-[16px] font-bold h-[48px] px-10 rounded-lg transition-all duration-300 flex items-center justify-center shadow-sm"
                >
                  {loadingType === 'id' ? 'მოწმდება...' : 'შემოწმება'}
                </button>
              </div>
            </form>

            {/* 2. PDF ატვირთვის სექცია (Drag and Drop-ით) */}
            <div className="w-full text-center border-t border-gray-100 pt-10">
              <h3 className="text-[18px] font-extrabold text-[#FE017E] mb-6">ან ატვირთეთ PDF სრული ვერიფიკაციისთვის</h3>
              
              <label 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full border-2 border-dashed rounded-2xl h-[240px] flex flex-col items-center justify-center cursor-pointer transition-all relative group shadow-sm ${
                  isDragging ? 'bg-[#FAD1E3] border-[#FE017E]' : 'bg-[#FCF2F6]/60 hover:bg-[#FCF2F6] border-[#FAD1E3]'
                }`}
              >
                {loadingType === 'file' ? (
                  <span className="text-[#FE017E] font-bold text-lg">მიმდინარეობს შემოწმება...</span>
                ) : (
                  <>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2C2D30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-4 group-hover:-translate-y-2 transition-transform duration-300">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    <span className="text-gray-500 text-[15px] font-semibold">
                      {isDragging ? 'ჩააგდეთ ფაილი აქ' : file ? file.name : 'დააკლიკეთ ან ჩააგდეთ PDF ფაილი'}
                    </span>
                  </>
                )}
                <input 
                  type="file" 
                  accept="application/pdf" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                  disabled={loadingType !== null} 
                />
              </label>
            </div>
            
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-[#1A1A1C] py-12 px-6 mt-auto">
        <div className="w-full max-w-[1000px] mx-auto flex flex-col md:flex-row items-center md:items-start gap-8">
          <div className="relative w-[180px] h-[115px] shrink-0">
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

      {/* Modal - შედეგის ფანჯარა */}
      {result && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-[2px] transition-opacity">
          <div className="bg-white rounded-[24px] p-8 max-w-[450px] w-full relative shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in duration-200">
            
            <button 
              onClick={closeModal}
              className="absolute top-5 right-5 text-gray-400 hover:text-black transition-colors cursor-pointer"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            {result.success ? (
              <>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${result.recordExists ? 'bg-green-100' : 'bg-red-100'}`}>
                  {result.recordExists ? (
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  )}
                </div>
                <h3 className="text-black font-extrabold text-[22px] mb-2">
                  {result.recordExists ? 'ვერიფიკაციის ჩანაწერი მოიძებნა' : 'ვერიფიკაციის ჩანაწერი არ მოიძებნა'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {result.recordExists
                    ? 'ქვემოთ ნაჩვენებია ჩანაწერის, PDF-ის, გამცემისა და ვერსიის ცალკეული სტატუსები.'
                    : 'ამ Verification ID-სთვის blockchain-ზე ოფიციალური ჩანაწერი არ არსებობს.'}
                </p>

                <dl className="w-full divide-y divide-gray-200 rounded-lg border border-gray-200 bg-gray-50 px-4 text-left">
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-sm text-gray-600">ოფიციალური ჩანაწერი</dt>
                    <dd className={`text-right text-sm font-bold ${result.recordExists ? 'text-green-700' : 'text-red-700'}`}>
                      {result.recordExists ? 'მოიძებნა' : 'არ მოიძებნა'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-sm text-gray-600">ატვირთული PDF-ის უცვლელობა</dt>
                    <dd className={`text-right text-sm font-bold ${result.documentIntegrity === 'VERIFIED' ? 'text-green-700' : result.documentIntegrity === 'FAILED' ? 'text-red-700' : 'text-gray-600'}`}>
                      {result.documentIntegrity === 'VERIFIED' ? 'დადასტურდა' : result.documentIntegrity === 'FAILED' ? 'არ ემთხვევა' : 'არ შემოწმებულა'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-sm text-gray-600">გამცემის იდენტობა (BTU)</dt>
                    <dd className={`text-right text-sm font-bold ${result.issuerAuthenticity === 'VERIFIED' ? 'text-green-700' : 'text-amber-700'}`}>
                      {result.issuerAuthenticity === 'VERIFIED' ? 'დადასტურდა' : result.issuerAuthenticity === 'UNVERIFIED' ? 'არ დადასტურდა' : result.issuerAuthenticity === 'NOT_CONFIGURED' ? 'ვერიფიკატორი არაა კონფიგურირებული' : 'არ შემოწმებულა'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-sm text-gray-600">ვერსიის სტატუსი</dt>
                    <dd className={`text-right text-sm font-bold ${result.latestStatus === 'LATEST' ? 'text-green-700' : 'text-amber-700'}`}>
                      {result.latestStatus === 'LATEST' ? `უახლესი (V${result.version})` : result.latestStatus === 'SUPERSEDED' ? `ავთენტური, ძველი (V${result.version})` : 'უცნობია'}
                    </dd>
                  </div>
                </dl>
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