import Link from 'next/link';
import { BrandLogo } from '@/components/brand';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-4">
        <BrandLogo size={64} />
      </div>
      <h1 className="text-lg font-extrabold text-slate-900">Page not found</h1>
      <p className="mt-1 text-sm text-slate-500">That page does not exist or was moved.</p>
      <Link href="/" className="btn-primary mt-6 w-full">
        Go home
      </Link>
    </main>
  );
}
