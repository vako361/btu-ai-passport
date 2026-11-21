import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "BTU | AI Skills Digital Passport",
  description: "Issue and verify BTU AI Skills Digital Passports.",
};

// Inline styles apply before any stylesheet parses, so the first paint of a document is already light.
const lightCanvas: CSSProperties = { backgroundColor: "#F4F5F7", colorScheme: "light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" style={lightCanvas}>
      <body className="min-h-full flex flex-col font-sans bg-[#F4F5F7] text-black" style={lightCanvas}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}