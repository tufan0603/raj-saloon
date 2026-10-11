'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { MailCheck, Send } from 'lucide-react';
import { AuthCard } from '@/components/auth-card';
import { Button, Field, Input } from '@/components/ui';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api<{ devLink?: string }>('/auth/forgot-password', { body: { email: email.trim() } });
      setSent(true);
      if (res.devLink) setDevLink(res.devLink);
    } catch (err: any) {
      setError(err.message || 'Could not send reset link');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Forgot password?"
      subtitle="Enter your email and we will send you a reset link."
      footer={
        <Link href="/login" className="font-bold text-brand-600">
          Back to login
        </Link>
      }
    >
      {sent ? (
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600">
            <MailCheck className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-900">Check your inbox</h3>
          <p className="mt-1 text-xs text-slate-500">
            If an account exists for <b>{email}</b>, a reset link has been sent. It is valid for 30 minutes.
          </p>
          {devLink && (
            <a href={devLink} className="mt-4 block break-all rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
              Dev mode (no SMTP configured): open reset link
            </a>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <Input type="email" inputMode="email" required placeholder="you@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}
          <Button type="submit" className="w-full" loading={busy}>
            <Send className="h-4 w-4" /> Send reset link
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
