import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-20">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-3">
        <Link href="/" className="underline hover:text-brand">
          Go to the home page
        </Link>
      </p>
    </main>
  );
}
