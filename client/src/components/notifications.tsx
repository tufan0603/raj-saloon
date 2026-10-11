'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Bell, BellRing, BellOff, CalendarPlus, CalendarX2, Wallet, UserPlus, Info, CheckCheck, Volume2, Smartphone, Send } from 'lucide-react';
import { Button, Sheet, Toggle } from './ui';
import { useToast } from './toast';
import { api } from '@/lib/api';
import { getPushState, isIosBrowserWithoutInstall, subscribeToPush, unsubscribeFromPush, type PushState } from '@/lib/push';
import { cn } from '@/lib/utils';

dayjs.extend(relativeTime);

interface Note {
  _id: string;
  type: 'booking_created' | 'booking_cancelled' | 'payment_claimed' | 'client_registered' | 'info';
  title: string;
  body: string;
  data: { url?: string };
  read: boolean;
  createdAt: string;
}

const ICON = { booking_created: CalendarPlus, booking_cancelled: CalendarX2, payment_claimed: Wallet, client_registered: UserPlus, info: Info };
const TONE = { booking_created: 'bg-brand-50 text-brand-700', booking_cancelled: 'bg-red-50 text-red-600', payment_claimed: 'bg-sky-50 text-sky-700', client_registered: 'bg-violet-50 text-violet-700', info: 'bg-slate-100 text-slate-600' };
const SOUND_KEY = 'saloonease_admin_sound';
const POLL_MS = 8000;

/** Shared audio element unlocked on the first user gesture (browsers block autoplay before that). */
let audio: HTMLAudioElement | null = null;
let unlocked = false;
function getAudio() {
  if (!audio && typeof window !== 'undefined') {
    audio = new Audio('/sounds/notify.wav');
    audio.preload = 'auto';
  }
  return audio;
}
function unlockAudio() {
  if (unlocked) return;
  const a = getAudio();
  if (!a) return;
  a.volume = 0;
  a.play().then(() => { a.pause(); a.currentTime = 0; a.volume = 1; unlocked = true; }).catch(() => {});
}
export function playNotifySound() {
  const a = getAudio();
  if (!a) return;
  a.volume = 1;
  a.currentTime = 0;
  a.play().catch(() => {});
  try { navigator.vibrate?.([120, 60, 120]); } catch {}
}

/** Bell button for the admin header: unread badge, bubble + sound on new events, feed sheet, push toggle. */
export function AdminBell() {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [push, setPush] = useState<PushState>('off');
  const [pushConfigured, setPushConfigured] = useState(true);
  const [sound, setSound] = useState(true);
  const [busy, setBusy] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const openRef = useRef(false);
  openRef.current = open;

  useEffect(() => {
    try { setSound(localStorage.getItem(SOUND_KEY) !== 'off'); } catch {}
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    getPushState().then(setPush);
    // the service worker forwards push payloads to open tabs
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'PUSH_RECEIVED') load(); };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await api<{ notifications: Note[]; unreadCount: number; pushConfigured: boolean }>('/admin/notifications', { query: { limit: 40 } });
      setPushConfigured(r.pushConfigured);
      setUnread(r.unreadCount);
      setItems(r.notifications);
      const fresh = r.notifications.filter((n) => !n.read && seen.current && !seen.current.has(n._id));
      if (seen.current && fresh.length) {
        if (localStorage.getItem(SOUND_KEY) !== 'off') playNotifySound();
        fresh.slice(0, 3).forEach((n) => toast.toast(`${n.title}${n.body ? ` - ${n.body}` : ''}`, n.type === 'booking_cancelled' ? 'error' : n.type === 'booking_created' ? 'success' : 'info'));
      }
      seen.current = new Set(r.notifications.map((n) => n._id));
    } catch { /* offline or logged out: ignore */ }
  }, [toast]);

  useEffect(() => {
    load();
    let t: ReturnType<typeof setInterval> | null = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { if (t) clearInterval(t); t = null; document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  const markAll = async () => {
    await api('/admin/notifications/read', { body: { all: true } }).catch(() => {});
    setItems((l) => l.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };
  const openItem = async (n: Note) => {
    if (!n.read) {
      api('/admin/notifications/read', { body: { ids: [n._id] } }).catch(() => {});
      setItems((l) => l.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    if (n.data?.url) router.push(n.data.url);
  };
  const togglePush = async () => {
    setBusy(true);
    try {
      const next = push === 'subscribed' ? await unsubscribeFromPush() : await subscribeToPush();
      setPush(next);
      if (next === 'subscribed') toast.success('Phone notifications enabled on this device');
      else if (next === 'denied') toast.error('Notifications are blocked in browser settings for this site');
      else if (next === 'unconfigured') toast.error('Server has no VAPID keys yet (see README)');
      else if (next === 'unsupported') toast.error(isIosBrowserWithoutInstall() ? 'On iPhone, add the app to your Home Screen first, then enable here' : 'This browser does not support push');
      else toast.info('Phone notifications turned off');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const toggleSound = (v: boolean) => {
    setSound(v);
    try { localStorage.setItem(SOUND_KEY, v ? 'on' : 'off'); } catch {}
    if (v) playNotifySound();
  };
  const sendTest = async () => {
    setBusy(true);
    try {
      await api('/admin/notifications/test', { body: {} });
      toast.info('Test sent. You should hear the chime and, if enabled, see a phone notification.');
      setTimeout(load, 800);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button onClick={() => { unlockAudio(); setOpen(true); }} aria-label="Notifications" className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100">
        {unread > 0 ? <BellRing className="h-5 w-5 text-brand-600" /> : <Bell className="h-5 w-5" />}
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={<span className="flex items-center gap-2">Notifications {unread > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[10px] text-white">{unread}</span>}</span>}>
        <div className="mb-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold text-slate-800"><Volume2 className="h-4 w-4 text-brand-600" /> Sound in app</span>
            <Toggle checked={sound} onChange={toggleSound} />
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
              {push === 'subscribed' ? <BellRing className="h-4 w-4 text-brand-600" /> : <BellOff className="h-4 w-4 text-slate-400" />} Phone notifications
            </span>
            <Button variant={push === 'subscribed' ? 'secondary' : 'primary'} className="px-3 py-1.5 text-xs" loading={busy} onClick={togglePush} disabled={!pushConfigured && push !== 'subscribed'}>
              <Smartphone className="h-3.5 w-3.5" /> {push === 'subscribed' ? 'On - turn off' : 'Enable'}
            </Button>
          </div>
          <p className="text-[11px] text-slate-500">
            {push === 'subscribed' ? 'This device gets a notification with sound even when the app is closed.' : !pushConfigured ? 'Server is missing VAPID keys; in-app alerts still work.' : isIosBrowserWithoutInstall() ? 'iPhone: install the app to your Home Screen (Share -> Add to Home Screen), then enable.' : 'Get alerts on this phone even when the app is closed.'}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1 py-1.5 text-xs" loading={busy} onClick={sendTest}><Send className="h-3.5 w-3.5" /> Send test</Button>
            <Button variant="secondary" className="flex-1 py-1.5 text-xs" onClick={markAll} disabled={!unread}><CheckCheck className="h-3.5 w-3.5" /> Mark all read</Button>
          </div>
        </div>

        {!items.length ? (
          <p className="py-8 text-center text-xs text-slate-400">No notifications yet. New bookings, cancellations and UPI payments will appear here.</p>
        ) : (
          <div className="space-y-1.5">
            {items.map((n) => {
              const I = ICON[n.type] || Info;
              return (
                <button key={n._id} onClick={() => openItem(n)} className={cn('flex w-full items-start gap-3 rounded-xl border p-3 text-left', n.read ? 'border-slate-100 bg-white' : 'border-brand-200 bg-brand-50/50')}>
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', TONE[n.type] || TONE.info)}><I className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-xs text-slate-900', n.read ? 'font-semibold' : 'font-extrabold')}>{n.title}</span>
                    {n.body && <span className="block text-[11px] leading-snug text-slate-500">{n.body}</span>}
                    <span className="mt-0.5 block text-[10px] text-slate-400">{dayjs(n.createdAt).fromNow()}</span>
                  </span>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                </button>
              );
            })}
          </div>
        )}
      </Sheet>
    </>
  );
}
