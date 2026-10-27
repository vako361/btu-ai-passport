import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    // ვშლით სტუდენტის სესიის ქუქის
    cookieStore.delete('student_session');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'გამოსვლა ვერ მოხერხდა' }, { status: 500 });
  }
}