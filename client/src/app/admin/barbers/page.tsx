'use client';
import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { AdminShell, LoadingRows, MediaUploader } from '@/components/admin';
import { Avatar, Badge, Button, Confirm, EmptyState, Field, Input, Select, Sheet, Textarea, Toggle } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import type { Barber, Media } from '@/lib/types';
import { cn, fmtTime, idOf, WEEKDAYS } from '@/lib/utils';

interface Form { _id?: string; name: string; title: string; bio: string; avatar: Media | null; userId: string; active: boolean; workingHours: { start: string; end: string }; weeklyOff: number[]; order: number }
const empty: Form = { name: '', title: 'Barber', bio: '', avatar: null, userId: '', active: true, workingHours: { start: '', end: '' }, weeklyOff: [], order: 0 };

export default function BarbersPage() {
  const toast = useToast();
  const list = useAsync(() => api<{ barbers: Barber[] }>('/admin/barbers').then((r) => r.barbers));
  const admins = useAsync(() => api<{ clients: { id: string; name: string; email: string }[] }>('/admin/clients', { query: { role: 'admin', limit: 100 } }).then((r) => r.clients));
  const [editing, setEditing] = useState<Form | null>(null);
  const [del, setDel] = useState<Barber | null>(null);
  const [busy, setBusy] = useState(false);

  const open = (b?: Barber) =>
    setEditing(b ? { _id: b._id, name: b.name, title: b.title || '', bio: b.bio || '', avatar: b.avatar || null, userId: idOf(b.user), active: b.active, workingHours: { start: b.workingHours?.start || '', end: b.workingHours?.end || '' }, weeklyOff: b.weeklyOff || [], order: b.order } : { ...empty, order: (list.data?.length || 0) + 1 });

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const { _id, ...body } = editing;
      const payload = { ...body, userId: body.userId || null };
      if (_id) await api(`/admin/barbers/${_id}`, { method: 'PATCH', body: payload });
      else await api('/admin/barbers', { body: payload });
      toast.success('Barber saved');
      setEditing(null);
      list.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const [usage, setUsage] = useState<{ active: number; total: number } | null>(null);
  const askDelete = async (b: Barber) => {
    setDel(b);
    setUsage(null);
    try {
      const r = await api<{ active: number; total: number }>(`/admin/barbers/${b._id}/usage`);
      setUsage({ active: r.active, total: r.total });
    } catch {
      setUsage({ active: 0, total: 0 });
    }
  };
  const remove = async () => {
    if (!del) return;
    setBusy(true);
    try {
      const r = await api<{ cancelledBookings: number }>(`/admin/barbers/${del._id}`, { method: 'DELETE', query: { force: usage?.active ? 'true' : undefined } });
      toast.success(r.cancelledBookings ? `Barber removed, ${r.cancelledBookings} booking(s) cancelled` : 'Barber removed');
      setDel(null);
      list.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const toggleDay = (d: number) => editing && setEditing({ ...editing, weeklyOff: editing.weeklyOff.includes(d) ? editing.weeklyOff.filter((x) => x !== d) : [...editing.weeklyOff, d] });

  return (
    <AdminShell title="Barbers" back="/admin/more" right={<button onClick={() => open()} className="btn-primary px-3 py-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> Add</button>}>
      {list.loading && !list.data ? (
        <LoadingRows />
      ) : !list.data?.length ? (
        <EmptyState title="No barbers yet" text="Add your staff so clients can pick a chair." action={<Button onClick={() => open()}>Add barber</Button>} />
      ) : (
        <div className="space-y-2">
          {list.data.map((b) => (
            <div key={b._id} className={cn('card flex items-center gap-3', !b.active && 'opacity-60')}>
              <Avatar name={b.name} src={b.avatar?.url} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-900">{b.name}</span>
                  {!b.active && <Badge className="bg-slate-200 text-slate-600">Inactive</Badge>}
                </div>
                <p className="truncate text-xs text-slate-500">
                  {b.title}
                  {b.workingHours?.start ? ` • ${fmtTime(b.workingHours.start)}-${fmtTime(b.workingHours.end)}` : ''}
                  {b.weeklyOff?.length ? ` • off ${b.weeklyOff.map((d) => WEEKDAYS[d]).join(', ')}` : ''}
                </p>
                {typeof b.user === 'object' && b.user && <p className="truncate text-[11px] text-brand-700">Login: {b.user.email}</p>}
              </div>
              <button onClick={() => open(b)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => askDelete(b)} className="rounded-lg p-2 text-red-400 hover:bg-red-50" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      <Sheet open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?._id ? 'Edit barber' : 'New barber'} footer={<Button className="w-full" loading={busy} onClick={save}>Save barber</Button>}>
        {editing && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar name={editing.name || '?'} src={editing.avatar?.url} size="xl" />
              <div className="space-y-1">
                <MediaUploader folder="barbers" onUploaded={(m) => setEditing({ ...editing, avatar: m[0] })} label={editing.avatar ? 'Change photo' : 'Upload photo'} />
                {editing.avatar && <button onClick={() => setEditing({ ...editing, avatar: null })} className="block text-xs font-semibold text-red-500">Remove photo</button>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Name"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Title"><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Senior Barber" /></Field>
            </div>
            <Field label="Bio"><Textarea value={editing.bio} onChange={(e) => setEditing({ ...editing, bio: e.target.value })} className="min-h-[56px]" /></Field>
            <Field label="Admin login account" hint="Link an admin user so their Today screen opens on this chair. Users become admin when linked.">
              <Select value={editing.userId} onChange={(e) => setEditing({ ...editing, userId: e.target.value })}>
                <option value="">Not linked</option>
                {admins.data?.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Start (override)" hint="Blank = salon hours"><Input type="time" value={editing.workingHours.start} onChange={(e) => setEditing({ ...editing, workingHours: { ...editing.workingHours, start: e.target.value } })} /></Field>
              <Field label="End (override)"><Input type="time" value={editing.workingHours.end} onChange={(e) => setEditing({ ...editing, workingHours: { ...editing.workingHours, end: e.target.value } })} /></Field>
            </div>
            <Field label="Weekly off">
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((w, i) => (
                  <button key={w} type="button" onClick={() => toggleDay(i)} className={cn('rounded-lg border py-2 text-[11px] font-bold', editing.weeklyOff.includes(i) ? 'border-red-300 bg-red-50 text-red-600' : 'border-slate-200 bg-white text-slate-600')}>{w}</button>
                ))}
              </div>
            </Field>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <Toggle checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} label="Accepting bookings" />
              <Input type="number" value={editing.order} onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) })} className="w-20 py-1.5" aria-label="Order" />
            </div>
          </div>
        )}
      </Sheet>
      <Confirm
        open={Boolean(del)}
        onClose={() => setDel(null)}
        onConfirm={remove}
        loading={busy || !usage}
        danger
        title={`Remove ${del?.name}?`}
        text={
          !usage
            ? 'Checking bookings...'
            : usage.active > 0
              ? `${del?.name} still has ${usage.active === 1 ? 'one client waiting or in the chair' : `${usage.active} clients waiting or in the chair`}. Removing the barber cancels ${usage.active === 1 ? 'that booking' : 'those bookings'} and the ${usage.active === 1 ? 'client sees' : 'clients see'} "Barber removed". To keep them, move each booking to another barber first, or simply mark ${del?.name} inactive.`
              : `${del?.name} has no upcoming bookings. ${usage.total ? `${usage.total === 1 ? 'One past visit stays' : `${usage.total} past visits stay`} in reports.` : ''} A linked admin login is only unlinked, never deleted.`
        }
        confirmText={usage?.active ? `Cancel ${usage.active} & remove` : 'Remove'}
      />
    </AdminShell>
  );
}
