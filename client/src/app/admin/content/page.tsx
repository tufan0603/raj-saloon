'use client';
import { useEffect, useState } from 'react';
import { Trash2, Save, Megaphone, Image as ImageIcon, Film, Store, Users, Scissors, Sparkles, Folder } from 'lucide-react';
import { AdminShell, MediaUploader } from '@/components/admin';
import { Button, Field, Input, SectionTitle, Select, Sheet, Skeleton, Textarea, Toggle } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { useSettings } from '@/lib/settings-context';
import type { Media, MediaCategory, Settings } from '@/lib/types';
import { cn } from '@/lib/utils';

const CATS: { value: MediaCategory; label: string; icon: any; hint: string }[] = [
  { value: 'shop', label: 'Shop', icon: Store, hint: 'Interior, chairs, front - shown in "The shop" and as hero fallback' },
  { value: 'barber', label: 'Barbers', icon: Users, hint: 'Barbers at work - used when a barber has no profile photo' },
  { value: 'demo', label: 'Cutting demo', icon: Scissors, hint: 'Short videos (MP4) or action photos - "Watch the craft" section' },
  { value: 'style', label: 'Cut designs', icon: Sparkles, hint: 'Finished looks - the lookbook grid' },
  { value: 'other', label: 'Other', icon: Folder, hint: 'Shown at the end of the lookbook' },
];

export default function ContentPage() {
  const toast = useToast();
  const { refresh } = useSettings();
  const data = useAsync(() => api<{ settings: Settings }>('/admin/settings').then((r) => r.settings));
  const [form, setForm] = useState<Partial<Settings> | null>(null);
  const [busy, setBusy] = useState(false);
  const [gallery, setGallery] = useState<Media[]>([]);
  const [cat, setCat] = useState<MediaCategory>('style');
  const [editing, setEditing] = useState<Media | null>(null);
  const [itemBusy, setItemBusy] = useState(false);

  useEffect(() => {
    if (data.data && !form) {
      const { salonName, tagline, about, phone, whatsapp, address, mapUrl, upiId, announcement, announcementActive, heroImage, logo } = data.data;
      setForm({ salonName, tagline, about, phone, whatsapp, address, mapUrl, upiId, announcement, announcementActive, heroImage, logo });
      setGallery(data.data.gallery || []);
    }
  }, [data.data, form]);

  const save = async () => {
    if (!form) return;
    setBusy(true);
    try {
      await api('/admin/settings', { method: 'PATCH', body: { ...form, heroImage: form.heroImage || null, logo: form.logo || null } });
      toast.success('Content saved');
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const addGallery = async (items: Media[]) => {
    try {
      const res = await api<{ gallery: Media[] }>('/admin/settings/gallery', { body: { items: items.map((m) => ({ ...m, category: cat })) } });
      setGallery(res.gallery);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const patchItem = async (id: string, body: { caption?: string; category?: MediaCategory }) => {
    setItemBusy(true);
    try {
      const res = await api<{ gallery: Media[] }>(`/admin/settings/gallery/${id}`, { method: 'PATCH', body });
      setGallery(res.gallery);
      setEditing(null);
      refresh();
      toast.success('Updated');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setItemBusy(false);
    }
  };
  const removeItem = async (id: string) => {
    setItemBusy(true);
    try {
      const res = await api<{ gallery: Media[] }>(`/admin/settings/gallery/${id}`, { method: 'DELETE' });
      setGallery(res.gallery);
      setEditing(null);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setItemBusy(false);
    }
  };

  if (!form) {
    return (
      <AdminShell title="Content" back="/admin/more">
        <Skeleton className="h-64" />
      </AdminShell>
    );
  }
  const set = (k: keyof Settings, v: any) => setForm({ ...form, [k]: v });
  const inCat = gallery.filter((g) => (g.category || 'style') === cat);
  const count = (c: MediaCategory) => gallery.filter((g) => (g.category || 'style') === c).length;
  const current = CATS.find((c) => c.value === cat)!;

  return (
    <AdminShell title="Content & Gallery" back="/admin/more" right={<Button onClick={save} loading={busy} className="px-3 py-1.5 text-xs"><Save className="h-3.5 w-3.5" /> Save</Button>}>
      <div className="space-y-4">
        {/* Gallery first: it is what the home page is made of */}
        <div className="card space-y-3">
          <SectionTitle title={`Home page photos & videos (${gallery.length})`} />
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {CATS.map((c) => (
              <button key={c.value} onClick={() => setCat(c.value)} className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition', cat === c.value ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600')}>
                <c.icon className="h-3.5 w-3.5" /> {c.label} <span className={cn('rounded-full px-1.5 text-[10px]', cat === c.value ? 'bg-white/20' : 'bg-slate-100')}>{count(c.value)}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">{current.hint}</p>
          <MediaUploader folder={cat} multiple accept={cat === 'demo' ? 'image/*,video/mp4,video/webm' : 'image/*'} onUploaded={addGallery} label={`Add to ${current.label}`} className="w-full" />
          {!inCat.length ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-6 text-center text-xs text-slate-400">Nothing here yet. Upload photos{cat === 'demo' ? ' or short videos' : ''} to fill this section of the home page.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {inCat.map((g) => (
                <button key={g._id || g.url} onClick={() => setEditing(g)} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100 text-left">
                  {g.resourceType === 'video' ? (
                    <div className="flex h-full items-center justify-center text-slate-400"><Film className="h-6 w-6" /></div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.url} alt="" className="h-full w-full object-cover" />
                  )}
                  {g.publicId?.startsWith('placeholder/') && <span className="absolute left-1 top-1 rounded bg-amber-500 px-1 text-[9px] font-bold text-white">SAMPLE</span>}
                  {g.caption && <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-0.5 text-[10px] text-white">{g.caption}</span>}
                </button>
              ))}
            </div>
          )}
          {gallery.some((g) => g.publicId?.startsWith('placeholder/')) && <p className="text-[11px] text-amber-700">Items marked SAMPLE are stock placeholders. Tap one to delete it once you upload your own.</p>}
        </div>

        <div className="card space-y-3">
          <SectionTitle title="Hero (top of home page)" />
          <div className="h-40 overflow-hidden rounded-xl bg-slate-100">
            {form.heroImage?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.heroImage.url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">No hero image. First shop photo is used.</div>
            )}
          </div>
          <div className="flex gap-2">
            <MediaUploader folder="branding" onUploaded={(m) => set('heroImage', m[0])} label={form.heroImage ? 'Replace' : 'Upload shop photo'} className="flex-1" />
            {form.heroImage && <Button variant="danger" onClick={() => set('heroImage', null)}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        </div>

        <div className="card space-y-3">
          <SectionTitle title="Branding" />
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-600 text-white">
              {form.logo?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logo.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-6 w-6" />
              )}
            </div>
            <div className="space-y-1">
              <MediaUploader folder="branding" onUploaded={(m) => set('logo', m[0])} label="Upload logo" />
              {form.logo && <button onClick={() => set('logo', null)} className="block text-xs font-semibold text-red-500">Remove</button>}
            </div>
          </div>
          <Field label="Salon name"><Input value={form.salonName || ''} onChange={(e) => set('salonName', e.target.value)} /></Field>
          <Field label="Tagline"><Input value={form.tagline || ''} onChange={(e) => set('tagline', e.target.value)} /></Field>
          <Field label="About the shop"><Textarea value={form.about || ''} onChange={(e) => set('about', e.target.value)} /></Field>
        </div>

        <div className="card space-y-3">
          <SectionTitle title="Announcement" icon={<Megaphone className="h-4 w-4 text-brand-600" />} action={<Toggle checked={Boolean(form.announcementActive)} onChange={(v) => set('announcementActive', v)} />} />
          <Textarea value={form.announcement || ''} onChange={(e) => set('announcement', e.target.value)} placeholder="e.g. Closed on 15th Aug. Festive offer: Hair + Beard at 180 this week!" className="min-h-[64px]" />
        </div>

        <div className="card space-y-3">
          <SectionTitle title="Contact" />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Phone"><Input type="tel" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="WhatsApp"><Input type="tel" value={form.whatsapp || ''} onChange={(e) => set('whatsapp', e.target.value)} placeholder="Same as phone" /></Field>
          </div>
          <Field label="Address"><Textarea value={form.address || ''} onChange={(e) => set('address', e.target.value)} className="min-h-[56px]" /></Field>
          <Field label="Google Maps link"><Input value={form.mapUrl || ''} onChange={(e) => set('mapUrl', e.target.value)} placeholder="https://maps.app.goo.gl/..." /></Field>
          <Field label="UPI ID" hint='Enter your UPI ID (e.g. 98765@ybl) to let clients "Pay now via UPI" with a QR code. No gateway needed; you confirm each payment from the booking.'><Input value={form.upiId || ''} onChange={(e) => set('upiId', e.target.value)} placeholder="salon@upi" /></Field>
        </div>

        <Button onClick={save} loading={busy} className="w-full"><Save className="h-4 w-4" /> Save content</Button>
      </div>

      <Sheet open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit media">
        {editing && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl bg-slate-100">
              {editing.resourceType === 'video' ? (
                <video src={editing.url} controls playsInline className="max-h-64 w-full" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={editing.url} alt="" className="max-h-64 w-full object-contain" />
              )}
            </div>
            <Field label="Section">
              <Select value={editing.category || 'style'} onChange={(e) => setEditing({ ...editing, category: e.target.value as MediaCategory })}>
                {CATS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </Field>
            <Field label="Caption"><Input value={editing.caption || ''} onChange={(e) => setEditing({ ...editing, caption: e.target.value })} placeholder="e.g. Skin fade" /></Field>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="danger" loading={itemBusy} onClick={() => editing._id && removeItem(editing._id)}><Trash2 className="h-4 w-4" /> Delete</Button>
              <Button className="col-span-2" loading={itemBusy} onClick={() => editing._id && patchItem(editing._id, { caption: editing.caption || '', category: editing.category || 'style' })}><Save className="h-4 w-4" /> Save</Button>
            </div>
          </div>
        )}
      </Sheet>
    </AdminShell>
  );
}
