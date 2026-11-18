import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { cleanupVisitorData } from '@/lib/demo/cleanup';
import { EnvConfigError, getDemoEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorized(request: Request, secret: string): boolean {
  const supplied = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

// Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  let demo;
  try {
    demo = getDemoEnv();
  } catch (error) {
    if (error instanceof EnvConfigError) return NextResponse.json({ error: 'Demo mode is misconfigured.' }, { status: 503 });
    throw error;
  }

  if (!demo.enabled) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (!demo.cronSecret) return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
  if (!authorized(request, demo.cronSecret)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const result = await cleanupVisitorData(await getPayload({ config }));
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Scheduled demo cleanup failed', error);
    return NextResponse.json({ error: 'Cleanup failed.' }, { status: 500 });
  }
}
