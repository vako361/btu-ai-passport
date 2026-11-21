import { AppRouteSkeleton } from '@/components/AppRouteSkeleton';

export default function Loading() {
  return (
    <AppRouteSkeleton label="Loading sign in" size="narrow">
      <div className="mx-auto h-96 max-w-md rounded-3xl bg-white" />
    </AppRouteSkeleton>
  );
}
