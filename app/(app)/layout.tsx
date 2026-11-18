import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "BTU | AI Skills Digital Passport",
  description: "Issue and verify BTU AI Skills Digital Passports.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-[#F4F5F7] text-black">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}