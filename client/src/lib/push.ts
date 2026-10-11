import { api } from './api';

export type PushState = 'unsupported' | 'denied' | 'subscribed' | 'off' | 'unconfigured';

const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function getPushState(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'subscribed' : 'off';
  } catch {
    return 'off';
  }
}

/** Ask permission, subscribe this device and register it with the API. */
export async function subscribeToPush(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  const key = await api<{ configured: boolean; publicKey: string }>('/push/public-key');
  if (!key.configured) return 'unconfigured';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key.publicKey) });
  await api('/push/subscribe', { body: { subscription: sub.toJSON(), userAgent: navigator.userAgent.slice(0, 300) } });
  return 'subscribed';
}

export async function unsubscribeFromPush(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await api('/push/subscribe', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe();
  }
  return 'off';
}

/** iOS Safari only delivers push to PWAs installed on the home screen. */
export const isIosBrowserWithoutInstall = () => {
  if (typeof navigator === 'undefined') return false;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
  return ios && !standalone;
};
