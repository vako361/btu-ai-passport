import { AppRouteSkeleton } from '@/components/AppRouteSkeleton';

export default function Loading() {
  return (
    <AppRouteSkeleton label="Loading your passport" subtitle="Student portal">
      <div className="h-96 rounded-3xl bg-white" />
    </AppRouteSkeleton>
  );
}
