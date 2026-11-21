'use client';

import { useState, Suspense, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';

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
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [verificationId, setVerificationId] = useState(searchParams.get('code') || '');
  const [result, setResult] = useState<VerificationResult | null>(null);
  
  const [loadingType, setLoadingType] = useState<'id' | 'file' | null>(null);
  const [isNavigating, startNavigation] = useTransition();
  const [isDragging, setIsDragging] = useState(false);

  const runVerification = async (formData: FormData, type: 'id' | 'file') => {
    setLoadingType(type);
    setResult(null);

    try {
      const response = await fetch('/api/verify', { method: 'POST', body: formData });
      
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(errorBody?.error || 'The server returned an error.');
      }
      
      const data: VerificationResult = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Verification request failed:', error);
      setResult({
        success: false,
        error: 'Could not reach the server, or the submitted data is invalid.',
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
      setResult({ success: false, error: 'Please upload a PDF file.' });
      return;
    }
    setFile(selectedFile);
    setVerificationId('');
    const formData = new FormData();
    formData.append('file', selectedFile);
    runVerification(formData, 'file');
  };

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
    const id = verificationId.trim();
    if (!id) return;
    // The transition keeps the pending state until the route commits, and clears it if navigation fails.
    startNavigation(() => {
      router.push(`/verify/${encodeURIComponent(id)}`);
    });
  };

  const closeModal = () => {
    setResult(null);
  };

  return (
    <div className="relative min-h-screen flex flex-col text-black font-sans z-0">
      
      <div className="absolute inset-0 bg-[#F4F5F7] -z-20"></div>
      <div className="absolute inset-0 bg-[url('/images/background.png')] bg-cover bg-no-repeat bg-center opacity-10 -z-10 pointer-events-none"></div>
      
      {/* Header */}
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
            <div className="text-300 text-[30px] font-light tracking-[0.08em] leading-none mt-1">
              DIGITAL PASSPORT
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-250 mx-auto pt-8 pb-12 px-6 flex flex-col justify-center mt-10">
        
        <div className="relative bg-white/70 backdrop-blur-[2px] w-full rounded-3xl shadow-md px-10 py-16 flex flex-col items-center">
          
          {/* Decorative artwork */}
          <Image src="/images/latest-skillset.png" alt="Latest AI Skillset" width={220} height={150} className="hidden lg:block absolute top-0 -left-12 w-55 -rotate-12 drop-shadow-lg z-10 pointer-events-none" />
          <Image src="/images/issued-by.png" alt="Issued by" width={200} height={150} className="hidden lg:block absolute top-[50%] -left-25 w-50 -rotate-12 drop-shadow-lg z-10 pointer-events-none" />
          <Image src="/images/blue-triangle.png" alt="AI Skills Digital Passport" width={160} height={120} className="hidden lg:block absolute top-[25%] -right-16 w-40 rotate-12 drop-shadow-lg z-10 pointer-events-none" />
          <Image src="/images/blockchain.png" alt="Blockchain Verified" width={180} height={150} className="hidden lg:block absolute bottom-12 -right-30 w-45 -rotate-6 drop-shadow-lg z-10 pointer-events-none" />

          <div className="text-center mb-8">
            <h2 className="text-[28px] font-black text-black">Passport verification</h2>
            <h3 className="text-[18px] font-extrabold text-[#FE017E] mt-2">Verify by code</h3>
          </div>

          <div className="flex flex-col items-center w-full max-w-175 z-20">
            
            <form onSubmit={handleIdSubmit} className="flex flex-col md:flex-row w-full gap-4 mb-12 items-end">
              <div className="flex-1 w-full">
                <label className="block text-[14px] font-semibold text-gray-500 mb-2">Verification code</label>
                <input 
                  type="text" 
                  placeholder="e.g. VER-1234567890ABCDEF12345678"
                  value={verificationId}
                  onChange={(e) => { setVerificationId(e.target.value); setFile(null); }}
                  className="w-full border border-gray-200 rounded-lg px-4 h-12 text-[15px] outline-none focus:border-[#FE017E] focus:ring-1 focus:ring-[#FE017E] transition-all font-medium bg-white"
                  disabled={loadingType !== null || isNavigating}
                />
              </div>
              <div className="flex w-full md:w-auto">
                <button 
                  type="submit" 
                  disabled={loadingType !== null || isNavigating || !verificationId}
                  className="w-full md:w-auto bg-[#FE017E] cursor-pointer hover:bg-[#d6006a] hover:scale-105 disabled:bg-gray-300 disabled:hover:scale-100 disabled:cursor-not-allowed text-white text-[16px] font-bold h-12 px-10 rounded-lg transition-all duration-300 flex items-center justify-center shadow-sm"
                >
                  {isNavigating ? 'Checking...' : 'Verify'}
                </button>
              </div>
            </form>

            <div className="w-full text-center border-t border-gray-100 pt-10">
              <h3 className="text-[18px] font-extrabold text-[#FE017E] mb-6">Or upload a PDF for full verification</h3>
              
              <label 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full border-2 border-dashed rounded-2xl h-60 flex flex-col items-center justify-center cursor-pointer transition-all relative group shadow-sm ${
                  isDragging ? 'bg-[#FAD1E3] border-[#FE017E]' : 'bg-[#FCF2F6]/60 hover:bg-[#FCF2F6] border-[#FAD1E3]'
                }`}
              >
                {loadingType === 'file' ? (
                  <span className="text-[#FE017E] font-bold text-lg">Verifying PDF...</span>
                ) : (
                  <>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2C2D30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-4 group-hover:-translate-y-2 transition-transform duration-300">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    <span className="text-gray-500 text-[15px] font-semibold">
                      {isDragging ? 'Drop your PDF here' : file ? file.name : 'Choose or drop a PDF file'}
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
            <p>Tbilisi 0179, Georgia</p>
            <p>82 Ilia Chavchavadze Avenue, Tbilisi</p>
            <p>(+995 32) 2 195 015</p>
          </div>
        </div>
      </footer>

      {result && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-[2px] transition-opacity">
          <div className="bg-white rounded-3xl p-8 max-w-112.5 w-full relative shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in duration-200">
            
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
                  {result.recordExists ? 'Credential record found' : 'Credential record not found'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {result.recordExists
                    ? 'Review the record, PDF, issuer, and version checks below.'
                    : 'No official ledger record exists for this Verification ID.'}
                </p>

                <dl className="w-full divide-y divide-gray-200 rounded-lg border border-gray-200 bg-gray-50 px-4 text-left">
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-sm text-gray-600">Official record</dt>
                    <dd className={`text-right text-sm font-bold ${result.recordExists ? 'text-green-700' : 'text-red-700'}`}>
                      {result.recordExists ? 'Found' : 'Not found'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-sm text-gray-600">PDF integrity</dt>
                    <dd className={`text-right text-sm font-bold ${result.documentIntegrity === 'VERIFIED' ? 'text-green-700' : result.documentIntegrity === 'FAILED' ? 'text-red-700' : 'text-gray-600'}`}>
                      {result.documentIntegrity === 'VERIFIED' ? 'Verified' : result.documentIntegrity === 'FAILED' ? 'Mismatch' : 'Not checked'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-sm text-gray-600">Issuer identity (BTU)</dt>
                    <dd className={`text-right text-sm font-bold ${result.issuerAuthenticity === 'VERIFIED' ? 'text-green-700' : 'text-amber-700'}`}>
                      {result.issuerAuthenticity === 'VERIFIED' ? 'Verified' : result.issuerAuthenticity === 'UNVERIFIED' ? 'Unverified' : result.issuerAuthenticity === 'NOT_CONFIGURED' ? 'Verifier not configured' : 'Not checked'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-sm text-gray-600">Version status</dt>
                    <dd className={`text-right text-sm font-bold ${result.latestStatus === 'LATEST' ? 'text-green-700' : 'text-amber-700'}`}>
                      {result.latestStatus === 'LATEST' ? `Current (V${result.version})` : result.latestStatus === 'SUPERSEDED' ? `Authentic, superseded (V${result.version})` : 'Unknown'}
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
                <h3 className="text-black font-extrabold text-[22px] mb-2">Verification failed</h3>
                <p className="text-gray-600 mb-6">{result.error || 'No record was found, or the file is invalid.'}</p>
              </>
            )}
            
            <button 
              onClick={closeModal}
              className="mt-6 w-full bg-gray-100 hover:bg-gray-200 text-black font-bold py-3 rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>

          </div>
        </div>
      )}
      
    </div>
  );
}