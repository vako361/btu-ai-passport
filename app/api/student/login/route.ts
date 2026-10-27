import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { email, studentId } = await request.json();

    if (!email || !studentId) {
      return NextResponse.json({ error: 'ელფოსტა და სტუდენტის ID სავალდებულოა.' }, { status: 400 });
    }

    const payload = await getPayload({ config });

    // ამოწმებს `students` კოლექციაში Email-სა და Student ID-ს
    const students = await payload.find({
      collection: 'students',
      where: {
        and: [
          { email: { equals: email.toLowerCase() } },
          { studentId: { equals: studentId } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    });

    const student = students.docs[0];
    if (!student) {
      return NextResponse.json({ error: 'სტუდენტი ამ მონაცემებით ვერ მოიძებნა.' }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set('student_session', JSON.stringify({ email: student.email, studentId: student.studentId }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    return NextResponse.json({ success: true, student });
  } catch (error) {
    console.error('Student login error:', error);
    return NextResponse.json({ error: 'სერვერული შეცდომა ავტორიზაციისას.' }, { status: 500 });
  }
}