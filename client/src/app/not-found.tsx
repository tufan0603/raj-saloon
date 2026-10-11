import Link from 'next/link';
import { Scissors } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white">
        <Scissors className="h-7 w-7" />
      </div>
      <h1 className="text-lg font-extrabold text-slate-900">Page not found</h1>
      <p className="mt-1 text-sm text-slate-500">That page does not exist or was moved.</p>
      <Link href="/" className="btn-primary mt-6 w-full">
        Go home
      </Link>
    </main>
  );
}
