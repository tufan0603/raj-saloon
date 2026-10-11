'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, KeyRound, LogOut, Save, ShieldCheck, Share2, CheckCircle2 } from 'lucide-react';
import { AppShell, RequireAuth } from '@/components/shell';
import { Avatar, Button, Field, Input, SectionTitle } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useInstallPrompt } from '@/lib/hooks';
import { openInstallSheet } from '@/components/pwa';
import type { User } from '@/lib/types';

function ProfileInner() {
  const { user, setUser, logout, isAdmin } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { canInstall, installed, isIOS } = useInstallPrompt();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api<{ user: User }>('/auth/me', { method: 'PATCH', body: { name: name.trim(), phone: phone.trim() } });
      setUser(res.user);
      toast.success('Profile updated');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const changePw = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.next !== pw.confirm) return toast.error('New passwords do not match');
    setPwBusy(true);
    try {
      await api('/auth/change-password', { body: { currentPassword: pw.current, newPassword: pw.next } });
      setPw({ current: '', next: '', confirm: '' });
      toast.success('Password changed');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPwBusy(false);
    }
  };

  const share = async () => {
    const data = { title: 'SaloonEase', text: 'Book your salon slot and track the live queue.', url: window.location.origin };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(data.url);
        toast.success('Link copied');
      }
    } catch {}
  };

  return (
    <AppShell nav="user" title="My Profile" subtitle={user?.email}>
      <div className="space-y-4">
        <div className="card flex items-center gap-3">
          <Avatar name={user?.name || ''} src={user?.avatar?.url} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-extrabold text-slate-900">{user?.name}</h2>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
            {isAdmin && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-700">
                <ShieldCheck className="h-3 w-3" /> Barber admin
              </span>
            )}
          </div>
        </div>

        {isAdmin && (
          <Link href="/admin" className="btn-secondary w-full border-brand-200 bg-brand-50 text-brand-700">
            <ShieldCheck className="h-4 w-4" /> Open Admin Panel
          </Link>
        )}

        <form onSubmit={save} className="card space-y-3">
          <SectionTitle title="Personal details" />
          <Field label="Full name">
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Mobile number">
            <Input type="tel" inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" />
          </Field>
          <Button type="submit" loading={saving} className="w-full">
            <Save className="h-4 w-4" /> Save changes
          </Button>
        </form>

        <form onSubmit={changePw} className="card space-y-3">
          <SectionTitle title="Change password" />
          <Field label="Current password">
            <Input type="password" autoComplete="current-password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          </Field>
          <Field label="New password">
            <Input type="password" autoComplete="new-password" required minLength={6} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </Field>
          <Field label="Confirm new password">
            <Input type="password" autoComplete="new-password" required value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </Field>
          <Button type="submit" variant="secondary" loading={pwBusy} className="w-full">
            <KeyRound className="h-4 w-4" /> Update password
          </Button>
        </form>

        <div className="card space-y-2">
          <SectionTitle title="App" />
          {installed ? (
            <p className="flex items-center gap-2 text-xs font-medium text-brand-700">
              <CheckCircle2 className="h-4 w-4" /> Installed on this device
            </p>
          ) : canInstall || isIOS ? (
            <Button variant="secondary" className="w-full" onClick={() => openInstallSheet()}>
              <Download className="h-4 w-4" /> Install app on phone
            </Button>
          ) : (
            <p className="text-xs text-slate-500">Open this site in Chrome on your phone to install it as an app.</p>
          )}
          <Button variant="secondary" className="w-full" onClick={share}>
            <Share2 className="h-4 w-4" /> Share with friends
          </Button>
        </div>

        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            logout();
            router.replace('/');
          }}
        >
          <LogOut className="h-4 w-4" /> Logout
        </Button>
      </div>
    </AppShell>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileInner />
    </RequireAuth>
  );
}
