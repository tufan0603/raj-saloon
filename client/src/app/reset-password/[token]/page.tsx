'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { AuthCard } from '@/components/auth-card';
import { Button, Field, Input } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import type { User } from '@/lib/types';

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { applyAuth } = useAuth();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('Passwords do not match');
    setBusy(true);
    try {
      const res = await api<{ token: string; user: User }>(`/auth/reset-password/${token}`, { body: { password } });
      applyAuth(res);
      toast.success('Password updated. You are logged in.');
      router.replace(res.user.role === 'admin' ? '/admin' : '/');
    } catch (err: any) {
      setError(err.message || 'Could not reset password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Set a new password"
      subtitle="Choose a strong password you have not used before."
      footer={
        <Link href="/login" className="font-bold text-brand-600">
          Back to login
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password">
          <Input type="password" autoComplete="new-password" required minLength={6} placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm new password">
          <Input type="password" autoComplete="new-password" required placeholder="Re-enter password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}
        <Button type="submit" className="w-full" loading={busy}>
          <KeyRound className="h-4 w-4" /> Update password
        </Button>
      </form>
    </AuthCard>
  );
}
