'use client';
import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { AdminShell } from '@/components/admin';
import { Button, Field, Input, SectionTitle, Skeleton, Toggle } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { useSettings } from '@/lib/settings-context';
import type { Settings } from '@/lib/types';
import { cn, WEEKDAYS } from '@/lib/utils';

const KEYS = ['openTime', 'closeTime', 'slotInterval', 'weeklyOff', 'maxAdvanceDays', 'tokenStart', 'allowOnlineBooking', 'maxActiveBookingsPerUser', 'timezone', 'siteUrl'] as const;
type Form = Pick<Settings, (typeof KEYS)[number]>;

export default function SalonSettingsPage() {
  const toast = useToast();
  const { refresh } = useSettings();
  const data = useAsync(() => api<{ settings: Settings }>('/admin/settings').then((r) => r.settings));
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data.data && !form) setForm(Object.fromEntries(KEYS.map((k) => [k, data.data![k]])) as Form);
  }, [data.data, form]);

  const save = async () => {
    if (!form) return;
    setBusy(true);
    try {
      await api('/admin/settings', { method: 'PATCH', body: form });
      toast.success('Settings saved');
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!form) {
    return (
      <AdminShell title="Salon settings" back="/admin/more">
        <Skeleton className="h-64" />
      </AdminShell>
    );
  }
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  const toggleDay = (d: number) => set('weeklyOff', form.weeklyOff.includes(d) ? form.weeklyOff.filter((x) => x !== d) : [...form.weeklyOff, d]);

  return (
    <AdminShell title="Salon settings" back="/admin/more" right={<Button onClick={save} loading={busy} className="px-3 py-1.5 text-xs"><Save className="h-3.5 w-3.5" /> Save</Button>}>
      <div className="space-y-4">
        <div className="card space-y-3">
          <SectionTitle title="Working hours" />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Opens at"><Input type="time" value={form.openTime} onChange={(e) => set('openTime', e.target.value)} /></Field>
            <Field label="Closes at"><Input type="time" value={form.closeTime} onChange={(e) => set('closeTime', e.target.value)} /></Field>
          </div>
          <Field label="Weekly off" hint="Barbers can have extra offs in their own profile.">
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w, i) => (
                <button key={w} type="button" onClick={() => toggleDay(i)} className={cn('rounded-lg border py-2 text-[11px] font-bold', form.weeklyOff.includes(i) ? 'border-red-300 bg-red-50 text-red-600' : 'border-slate-200 bg-white text-slate-600')}>{w}</button>
              ))}
            </div>
          </Field>
          <Field label="Timezone" hint="IANA name, e.g. Asia/Kolkata"><Input value={form.timezone} onChange={(e) => set('timezone', e.target.value)} /></Field>
        </div>

        <div className="card space-y-3">
          <SectionTitle title="Public link" />
          <Field label="Website URL" hint="Used for the shop QR code, shop card and share links. Leave empty to use the current address.">
            <Input type="url" inputMode="url" value={form.siteUrl || ''} onChange={(e) => set('siteUrl', e.target.value)} placeholder="https://raj-saloon.vercel.app" />
          </Field>
        </div>

        <div className="card space-y-3">
          <SectionTitle title="Booking rules" />
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
            <div>
              <p className="text-xs font-bold text-slate-900">Online booking</p>
              <p className="text-[11px] text-slate-500">Turn off to accept walk-ins only</p>
            </div>
            <Toggle checked={form.allowOnlineBooking} onChange={(v) => set('allowOnlineBooking', v)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Slot size (min)" hint="Gap between slot times"><Input type="number" inputMode="numeric" min={5} max={120} step={5} value={form.slotInterval} onChange={(e) => set('slotInterval', Number(e.target.value))} /></Field>
            <Field label="Book ahead (days)"><Input type="number" inputMode="numeric" min={0} max={60} value={form.maxAdvanceDays} onChange={(e) => set('maxAdvanceDays', Number(e.target.value))} /></Field>
            <Field label="Token starts at"><Input type="number" inputMode="numeric" min={1} value={form.tokenStart} onChange={(e) => set('tokenStart', Number(e.target.value))} /></Field>
            <Field label="Max active per client"><Input type="number" inputMode="numeric" min={1} max={10} value={form.maxActiveBookingsPerUser} onChange={(e) => set('maxActiveBookingsPerUser', Number(e.target.value))} /></Field>
          </div>
        </div>

        <Button onClick={save} loading={busy} className="w-full"><Save className="h-4 w-4" /> Save settings</Button>
      </div>
    </AdminShell>
  );
}
