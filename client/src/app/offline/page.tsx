import { WifiOff } from 'lucide-react';
import Link from 'next/link';

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <WifiOff className="h-8 w-8" />
      </div>
      <h1 className="text-lg font-extrabold text-slate-900">You are offline</h1>
      <p className="mt-1 text-sm text-slate-500">Live queue and bookings need an internet connection. Reconnect and try again.</p>
      <Link href="/" className="btn-primary mt-6 w-full">
        Retry
      </Link>
    </main>
  );
}
