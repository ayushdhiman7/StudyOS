import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid gap-3">
      <h1 className="text-2xl font-semibold">That page is not in StudyOS</h1>
      <Link className="text-teal" href="/">Back home</Link>
    </main>
  );
}
