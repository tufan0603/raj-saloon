'use client';
import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { AuthCard } from '@/components/auth-card';
import { Button, Field, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';

function RegisterForm() {
  const { register, user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const next = params.get('next');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submitted = useRef(false);
  useEffect(() => {
    // Only bounce users who arrive already logged in; after our own submit we redirect explicitly below.
    if (!loading && user && !submitted.current) router.replace(next || '/');
  }, [user, loading, next, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    if (!/^[0-9]{10}$/.test(form.phone.replace(/\D/g, ''))) return setError('Enter a valid 10-digit mobile number');
    setBusy(true);
    submitted.current = true;
    try {
      const u = await register({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), password: form.password });
      toast.success(`Account created. Welcome, ${u.name.split(' ')[0]}!`);
      router.replace(next || (u.role === 'admin' ? '/admin' : '/book'));
    } catch (err: any) {
      setError(err.message || 'Could not create account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Book in seconds and get your token on your phone."
      footer={
        <>
          Already have an account?{' '}
          <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-bold text-brand-600">
            Login
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Full name">
          <Input required autoComplete="name" placeholder="e.g. Aman Verma" value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Gmail address">
          <Input type="email" inputMode="email" autoComplete="email" required placeholder="you@gmail.com" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Mobile number" hint="The barber may call you when your turn is near.">
          <Input type="tel" inputMode="numeric" autoComplete="tel" required maxLength={10} placeholder="10-digit mobile number" value={form.phone} onChange={set('phone')} />
        </Field>
        <Field label="Password">
          <div className="relative">
            <Input type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={6} placeholder="At least 6 characters" value={form.password} onChange={set('password')} className="pr-11" />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label="Toggle password" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <Field label="Confirm password">
          <Input type={show ? 'text' : 'password'} autoComplete="new-password" required placeholder="Re-enter password" value={form.confirm} onChange={set('confirm')} />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}
        <Button type="submit" className="w-full" loading={busy}>
          <UserPlus className="h-4 w-4" /> Create account
        </Button>
        <p className="text-center text-[11px] text-slate-400">By continuing you agree to receive booking updates on email.</p>
      </form>
    </AuthCard>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
