import { AppRouteSkeleton } from '@/components/AppRouteSkeleton';

export default function Loading() {
  return (
    <AppRouteSkeleton label="Checking credential" subtitle="Credential verification" size="narrow">
      <div className="h-20 rounded-2xl bg-white" />
      <div className="h-80 rounded-3xl bg-white" />
    </AppRouteSkeleton>
  );
}
