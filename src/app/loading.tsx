export default function Loading() {
  return (
    <main className="grid gap-3" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-8 w-48" />
      <div className="skeleton h-36 w-full" />
      <div className="skeleton h-24 w-full" />
    </main>
  );
}
