import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export function AppHeader({ subtitle, children }: { subtitle?: string; children?: ReactNode }) {
  return (
    <header className="w-full bg-[#FE017E] px-6 py-4 text-white shadow-md sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-4">
          <span className="relative h-14 w-14 shrink-0 sm:h-16 sm:w-16">
            <Image
              src="https://btu.edu.ge/wp-content/uploads/2021/03/logo_w-1.png"
              alt="BTU logo"
              fill
              unoptimized
              className="object-contain"
            />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-xl font-extrabold tracking-wide sm:text-2xl">AI SKILLS</span>
            <span className="mt-1 text-base font-light tracking-[0.08em] sm:text-lg">DIGITAL PASSPORT</span>
            {subtitle ? <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-pink-100">{subtitle}</span> : null}
          </span>
        </Link>
        {children}
      </div>
    </header>
  );
}
