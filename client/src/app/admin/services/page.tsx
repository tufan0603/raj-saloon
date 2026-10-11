'use client';
import { useState } from 'react';
import { Plus, Pencil, Trash2, ImageIcon } from 'lucide-react';
import { AdminShell, LoadingRows, MediaUploader } from '@/components/admin';
import { Badge, Button, Confirm, EmptyState, Field, Input, Sheet, Textarea, Toggle } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import type { Media, Service } from '@/lib/types';
import { cn, money } from '@/lib/utils';

const empty = { name: '', description: '', price: 0, compareAtPrice: '' as string | number, duration: 30, popular: false, active: true, order: 0, image: null as Media | null };

export default function ServicesPage() {
  const toast = useToast();
  const list = useAsync(() => api<{ services: Service[] }>('/admin/services').then((r) => r.services));
  const [editing, setEditing] = useState<(typeof empty & { _id?: string }) | null>(null);
  const [del, setDel] = useState<Service | null>(null);
  const [busy, setBusy] = useState(false);

  const open = (s?: Service) => setEditing(s ? { _id: s._id, name: s.name, description: s.description || '', price: s.price, compareAtPrice: s.compareAtPrice ?? '', duration: s.duration, popular: Boolean(s.popular), active: s.active, order: s.order, image: s.image || null } : { ...empty, order: (list.data?.length || 0) + 1 });

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const body = { ...editing, compareAtPrice: editing.compareAtPrice === '' ? null : Number(editing.compareAtPrice) };
      delete (body as any)._id;
      if (editing._id) await api(`/admin/services/${editing._id}`, { method: 'PATCH', body });
      else await api('/admin/services', { body });
      toast.success('Service saved');
      setEditing(null);
      list.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const toggleActive = async (s: Service) => {
    try {
      await api(`/admin/services/${s._id}`, { method: 'PATCH', body: { active: !s.active } });
      list.refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const remove = async () => {
    if (!del) return;
    setBusy(true);
    try {
      await api(`/admin/services/${del._id}`, { method: 'DELETE' });
      toast.success('Service deleted');
      setDel(null);
      list.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell title="Services & Prices" back="/admin/more" right={<button onClick={() => open()} className="btn-primary px-3 py-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> Add</button>}>
      {list.loading && !list.data ? (
        <LoadingRows />
      ) : !list.data?.length ? (
        <EmptyState title="No services yet" text="Add your first service with price and duration." action={<Button onClick={() => open()}>Add service</Button>} />
      ) : (
        <div className="space-y-2">
          {list.data.map((s) => (
            <div key={s._id} className={cn('card flex items-center gap-3', !s.active && 'opacity-60')}>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-400">
                {s.image?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-bold text-slate-900">{s.name}</span>
                  {s.popular && <Badge className="bg-brand-600 text-white">Popular</Badge>}
                  {!s.active && <Badge className="bg-slate-200 text-slate-600">Hidden</Badge>}
                </div>
                <p className="text-xs text-slate-500">
                  <b className="text-brand-700">{money(s.price)}</b>
                  {s.compareAtPrice ? <span className="ml-1 line-through">{money(s.compareAtPrice)}</span> : null} &bull; {s.duration} mins
                </p>
              </div>
              <Toggle checked={s.active} onChange={() => toggleActive(s)} />
              <button onClick={() => open(s)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => setDel(s)} className="rounded-lg p-2 text-red-400 hover:bg-red-50" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      <Sheet open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?._id ? 'Edit service' : 'New service'} footer={<Button className="w-full" loading={busy} onClick={save}>Save service</Button>}>
        {editing && (
          <div className="space-y-3">
            <Field label="Name"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Hair Cut" /></Field>
            <Field label="Description"><Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="min-h-[56px]" placeholder="Short description" /></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Price"><Input type="number" inputMode="numeric" min={0} value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></Field>
              <Field label="Was price" hint="optional"><Input type="number" inputMode="numeric" min={0} value={editing.compareAtPrice} onChange={(e) => setEditing({ ...editing, compareAtPrice: e.target.value })} /></Field>
              <Field label="Minutes"><Input type="number" inputMode="numeric" min={5} step={5} value={editing.duration} onChange={(e) => setEditing({ ...editing, duration: Number(e.target.value) })} /></Field>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <Toggle checked={editing.popular} onChange={(v) => setEditing({ ...editing, popular: v })} label="Highlight as popular" />
              <Toggle checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} label="Visible" />
            </div>
            <Field label="Image (optional)">
              <div className="flex items-center gap-3">
                {editing.image?.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editing.image.url} alt="" className="h-14 w-14 rounded-xl object-cover" />
                )}
                <MediaUploader folder="services" onUploaded={(m) => setEditing({ ...editing, image: m[0] })} label={editing.image ? 'Replace' : 'Upload'} />
                {editing.image && <button onClick={() => setEditing({ ...editing, image: null })} className="text-xs font-semibold text-red-500">Remove</button>}
              </div>
            </Field>
            <Field label="Display order"><Input type="number" value={editing.order} onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) })} /></Field>
          </div>
        )}
      </Sheet>
      <Confirm open={Boolean(del)} onClose={() => setDel(null)} onConfirm={remove} loading={busy} danger title={`Delete ${del?.name}?`} text="Past bookings keep their price history. Services with active bookings cannot be deleted; hide them instead." confirmText="Delete" />
    </AdminShell>
  );
}
