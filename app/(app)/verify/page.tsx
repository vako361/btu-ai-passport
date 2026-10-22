'use client'; // ეს ეუბნება Next.js-ს, რომ ეს არის ბრაუზერის (კლიენტის) კოდი

import { useState } from 'react';

export default function VerifyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [verificationId, setVerificationId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // ეს ფუნქცია ეშვება ღილაკზე დაჭერისას
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    // 1. ვქმნით FormData ობიექტს, რათა ფაილი და ტექსტი ერთად გავაგზავნოთ
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    } else if (verificationId) {
      formData.append('verificationId', verificationId);
    } else {
      alert("გთხოვთ, ატვირთოთ ფაილი ან ჩაწეროთ ID");
      setLoading(false);
      return;
    }

    try {
      // 2. ვუკავშირდებით შენს დაწერილ route.ts ფაილს
      const response = await fetch('/api/verify', {
        method: 'POST',
        body: formData, // ვატანთ გამზადებულ მონაცემებს
      });

      const data = await response.json();
      
      // 3. მიღებულ პასუხს ვინახავთ ეკრანზე გამოსაჩენად
      setResult(data);
    } catch (error) {
      console.error("შეცდომა კავშირისას:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px' }}>
      <h1>პასპორტის გადამოწმება</h1>
      
      <form onSubmit={handleVerify}>
        <div style={{ marginBottom: '10px' }}>
          <label>ატვირთე PDF ფაილი:</label><br />
          <input 
            type="file" 
            accept="application/pdf" 
            onChange={(e) => setFile(e.target.files?.[0] || null)} 
          />
        </div>

        <p>ან</p>

        <div style={{ marginBottom: '10px' }}>
          <label>ჩაწერე ვერიფიკაციის ID:</label><br />
          <input 
            type="text" 
            placeholder="მაგ: VER-123456"
            value={verificationId}
            onChange={(e) => setVerificationId(e.target.value)}
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'მოწმდება...' : 'გადამოწმება'}
        </button>
      </form>

      {/* შედეგის გამოჩენა ეკრანზე */}
      {result && (
        <div style={{ marginTop: '20px', padding: '10px', border: '1px solid black' }}>
          {result.success && result.data.isValid ? (
            <h3 style={{ color: 'green' }}>✅ დოკუმენტი ნამდვილია!</h3>
          ) : (
            <h3 style={{ color: 'red' }}>❌ დოკუმენტი გაყალბებულია ან არ მოიძებნა.</h3>
          )}
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}