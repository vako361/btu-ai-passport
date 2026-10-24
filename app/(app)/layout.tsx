import type { Metadata } from "next";
import { Noto_Sans_Georgian } from "next/font/google";
import "./globals.css";

// 1. შემოგვაქვს ქართული ენის მხარდაჭერის მქონე თანამედროვე ფონტი
const notoSansGeorgian = Noto_Sans_Georgian({
  variable: "--font-noto-georgian",
  subsets: ["georgian", "latin"],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: "BTU | AI Skills Digital Passport",
  description: "AI Skills ციფრული პასპორტის ვერიფიკაცია",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ka"
      className={`${notoSansGeorgian.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#F4F5F7] text-black">
        {children}
      </body>
    </html>
  );
}