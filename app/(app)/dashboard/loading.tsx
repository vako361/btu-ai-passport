import { AppRouteSkeleton } from '@/components/AppRouteSkeleton';

export default function Loading() {
  return (
    <AppRouteSkeleton label="Loading dashboard" subtitle="Administrator dashboard">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-24 rounded-2xl bg-white" />
        ))}
      </div>
      <div className="h-72 rounded-3xl bg-white" />
      <div className="h-56 rounded-2xl bg-white" />
    </AppRouteSkeleton>
  );
}
