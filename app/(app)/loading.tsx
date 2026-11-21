export default function Loading() {
  return (
    <main aria-busy="true" aria-live="polite" className="mx-auto flex min-h-[70vh] w-full max-w-6xl items-center bg-[#F4F5F7] px-6 py-10">
      <span className="sr-only">Loading page</span>
      <div className="w-full animate-pulse space-y-6" aria-hidden="true">
        <div className="h-8 w-56 rounded bg-gray-200" />
        <div className="h-4 max-w-xl rounded bg-gray-200" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-28 rounded-xl bg-white" />
          <div className="h-28 rounded-xl bg-white" />
          <div className="h-28 rounded-xl bg-white" />
        </div>
      </div>
    </main>
  );
}