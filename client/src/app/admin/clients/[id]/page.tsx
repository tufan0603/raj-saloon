'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Phone, MessageCircle, Plus, Ban, ShieldCheck, Mail } from 'lucide-react';
import { AdminShell, BookForClientSheet, BookingActionSheet, LoadingRows } from '@/components/admin';
import { BookingCard } from '@/components/booking';
import { Avatar, Button, Confirm, EmptyState } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import type { Booking, User } from '@/lib/types';
import { money, waLink } from '@/lib/utils';

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { user: me } = useAuth();
  const data = useAsync(() => api<{ client: User; bookings: Booking[] }>(`/admin/clients/${id}`), [id]);
  const [bookOpen, setBookOpen] = useState(false);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [confirm, setConfirm] = useState<'block' | 'role' | null>(null);
  const [busy, setBusy] = useState(false);
  const c = data.data?.client;

  const patch = async (body: Partial<User>) => {
    setBusy(true);
    try {
      await api(`/admin/clients/${id}`, { method: 'PATCH', body });
      toast.success('Updated');
      setConfirm(null);
      data.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const spent = (data.data?.bookings || []).filter((b) => b.payment.status === 'paid').reduce((s, b) => s + b.payment.amount, 0);
  const isSelf = me?.id === id;

  return (
    <AdminShell title={c?.name || 'Client'} back="/admin/clients" subtitle={c?.email}>
      {!c ? (
        <LoadingRows />
      ) : (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center gap-3">
              <Avatar name={c.name} src={c.avatar?.url} size="lg" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-extrabold text-slate-900">{c.name}</h2>
                <p className="flex items-center gap-1 truncate text-xs text-slate-500"><Mail className="h-3 w-3" /> {c.email}</p>
                <p className="text-xs text-slate-500">{c.phone || 'No phone'}</p>
                <div className="mt-1 flex gap-1.5">
                  {c.role === 'admin' && <span className="chip bg-brand-50 text-brand-700"><ShieldCheck className="h-3 w-3" /> Admin</span>}
                  {c.isBlocked && <span className="chip bg-red-50 text-red-600"><Ban className="h-3 w-3" /> Blocked</span>}
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-slate-50 p-2"><b className="block text-base text-slate-900">{data.data!.bookings.filter((b) => b.status === 'done').length}</b>visits</div>
              <div className="rounded-xl bg-slate-50 p-2"><b className="block text-base text-slate-900">{money(spent)}</b>spent</div>
              <div className="rounded-xl bg-slate-50 p-2"><b className="block text-base text-slate-900">{data.data!.bookings.filter((b) => b.status === 'no_show').length}</b>no-shows</div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {c.phone ? (
                <>
                  <a href={`tel:${c.phone}`} className="btn-secondary py-2 text-xs"><Phone className="h-3.5 w-3.5" /> Call</a>
                  <a href={waLink(c.phone)} target="_blank" rel="noreferrer" className="btn-secondary py-2 text-xs"><MessageCircle className="h-3.5 w-3.5" /> Chat</a>
                </>
              ) : (
                <span className="col-span-2" />
              )}
              <Button onClick={() => setBookOpen(true)} className="py-2 text-xs"><Plus className="h-3.5 w-3.5" /> Book</Button>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold text-slate-900">Booking history</h3>
            {!data.data!.bookings.length ? (
              <EmptyState title="No bookings yet" />
            ) : (
              <div className="space-y-2">
                {data.data!.bookings.map((b) => (
                  <div key={b._id} onClick={() => setSelected(b)}>
                    <BookingCard b={b} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {!isSelf && (
            <div className="card space-y-2">
              <h3 className="text-sm font-bold text-slate-900">Account</h3>
              <Button variant="secondary" className="w-full" onClick={() => setConfirm('role')}>
                <ShieldCheck className="h-4 w-4" /> {c.role === 'admin' ? 'Remove admin access' : 'Make admin (barber)'}
              </Button>
              <Button variant={c.isBlocked ? 'secondary' : 'danger'} className="w-full" onClick={() => setConfirm('block')}>
                <Ban className="h-4 w-4" /> {c.isBlocked ? 'Unblock client' : 'Block client'}
              </Button>
            </div>
          )}
        </div>
      )}

      <BookForClientSheet open={bookOpen} onClose={() => setBookOpen(false)} onCreated={() => data.refresh()} client={c ? { id: c.id, name: c.name, phone: c.phone } : undefined} />
      <BookingActionSheet booking={selected} onClose={() => setSelected(null)} onChanged={() => data.refresh()} />
      <Confirm
        open={confirm === 'block'}
        onClose={() => setConfirm(null)}
        onConfirm={() => patch({ isBlocked: !c?.isBlocked })}
        loading={busy}
        danger={!c?.isBlocked}
        title={c?.isBlocked ? 'Unblock this client?' : 'Block this client?'}
        text={c?.isBlocked ? 'They will be able to login and book again.' : 'Blocked clients cannot login or book online. Use for repeated no-shows.'}
        confirmText={c?.isBlocked ? 'Unblock' : 'Block'}
      />
      <Confirm
        open={confirm === 'role'}
        onClose={() => setConfirm(null)}
        onConfirm={() => patch({ role: c?.role === 'admin' ? 'user' : 'admin' })}
        loading={busy}
        title={c?.role === 'admin' ? 'Remove admin access?' : 'Give admin access?'}
        text={c?.role === 'admin' ? 'They will become a normal client.' : 'Admins can manage bookings, prices, content and clients from the same app login.'}
        confirmText="Confirm"
      />
    </AdminShell>
  );
}
