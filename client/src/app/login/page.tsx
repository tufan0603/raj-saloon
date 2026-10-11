'use client';
import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { AuthCard } from '@/components/auth-card';
import { Button, Field, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';

function LoginForm() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const next = params.get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submitted = useRef(false);
  useEffect(() => {
    if (!loading && user && !submitted.current) router.replace(next || (user.role === 'admin' ? '/admin' : '/'));
  }, [user, loading, next, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    submitted.current = true;
    try {
      const u = await login(email.trim(), password);
      toast.success(`Welcome back, ${u.name.split(' ')[0]}!`);
      router.replace(next || (u.role === 'admin' ? '/admin' : '/'));
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Login to book slots and track your live turn."
      footer={
        <>
          New here?{' '}
          <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-bold text-brand-600">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email (Gmail)">
          <Input type="email" inputMode="email" autoComplete="email" required placeholder="you@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <div className="relative">
            <Input type={show ? 'text' : 'password'} autoComplete="current-password" required placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-11" />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label="Toggle password" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <div className="-mt-2 text-right">
          <Link href="/forgot-password" className="text-xs font-semibold text-brand-600">
            Forgot password?
          </Link>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}
        <Button type="submit" className="w-full" loading={busy}>
          <LogIn className="h-4 w-4" /> Login
        </Button>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
