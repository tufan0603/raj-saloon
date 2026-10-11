'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock, MapPin, Megaphone, MessageCircle, Phone, Scissors, Timer, Users, ChevronRight, Sparkles, Navigation } from 'lucide-react';
import { AppShell } from '@/components/shell';
import { Lightbox, MediaThumb, SectionHead, Strip, useOpenNow } from '@/components/home';
import { api } from '@/lib/api';
import { useAsync, usePolling } from '@/lib/hooks';
import { useSettings } from '@/lib/settings-context';
import { useAuth } from '@/lib/auth-context';
import type { Barber, Media, QueueData, Service } from '@/lib/types';
import { cn, fmtTime, initials, money, waLink, WEEKDAYS } from '@/lib/utils';

export default function HomePage() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const services = useAsync(() => api<{ services: Service[] }>('/services').then((r) => r.services));
  const barbers = useAsync(() => api<{ barbers: Barber[] }>('/barbers').then((r) => r.barbers));
  const queue = usePolling(() => api<{ queue: QueueData | null }>('/queue').then((r) => r.queue), 20000);
  const openNow = useOpenNow(settings.openTime, settings.closeTime, settings.weeklyOff);
  const [lb, setLb] = useState<{ items: Media[]; index: number | null }>({ items: [], index: null });
  const [showAllStyles, setShowAllStyles] = useState(false);

  const gallery = settings.gallery || [];
  const by = (c: Media['category']) => gallery.filter((g) => (g.category || 'style') === c);
  const shop = by('shop');
  const demoAll = by('demo');
  const demoVideos = demoAll.filter((g) => g.resourceType === 'video');
  const demoImages = demoAll.filter((g) => g.resourceType !== 'video');
  const styles = useMemo(() => [...by('style'), ...by('other')], [gallery]); // eslint-disable-line react-hooks/exhaustive-deps
  const barberShots = by('barber');
  const hero = settings.heroImage?.url || shop[0]?.url;
  const visibleStyles = showAllStyles ? styles : styles.slice(0, 7);
  const openLb = (items: Media[], index: number) => setLb({ items, index });

  const waiting = queue.data?.waiting.length ?? 0;
  const wait = queue.data?.totalWaitMinutes ?? 0;
  const serving = queue.data?.serving;
  const firstName = user?.name.split(' ')[0];

  return (
    <AppShell nav="user" bare>
      {/* ================= HERO ================= */}
      <section className="relative h-[72dvh] min-h-[460px] w-full overflow-hidden bg-slate-900 text-white">
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/10" />
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <span className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold backdrop-blur', openNow.open ? 'bg-brand-500/90 text-white' : 'bg-white/15 text-white')}>
            <span className={cn('h-1.5 w-1.5 rounded-full', openNow.open ? 'animate-pulse bg-white' : 'bg-red-400')} /> {openNow.label}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 pb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-300">{firstName ? `Welcome back, ${firstName}` : settings.tagline}</p>
          <h1 className="mt-1.5 text-[2.4rem] font-black leading-[1.02] tracking-tight">
            Look sharp.<br />Skip the wait.
          </h1>
          <p className="mt-2 max-w-[300px] text-sm text-slate-300">Pick your barber, grab a token and walk in exactly when it is your turn at {settings.salonName}.</p>

          <div className="mt-4 flex items-center gap-2">
            <Link href="/book" className="btn-primary flex-1 py-3 text-sm">
              Book a slot <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/dashboard" className="btn border border-white/25 bg-white/10 px-4 py-3 text-sm text-white backdrop-blur">
              <Timer className="h-4 w-4" /> Live queue
            </Link>
          </div>
        </div>
      </section>

      {/* ================= LIVE BAND ================= */}
      <section className="bg-slate-950 text-white">
        <div className="grid grid-cols-3 divide-x divide-white/10">
          <div className="flex flex-col items-center py-3.5">
            <span className="text-lg font-black leading-none">{serving ? `#${serving.tokenNumber}` : '--'}</span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">In chair</span>
          </div>
          <div className="flex flex-col items-center py-3.5">
            <span className="text-lg font-black leading-none">{queue.loading && !queue.data ? '-' : waiting}</span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Waiting</span>
          </div>
          <div className="flex flex-col items-center py-3.5">
            <span className="text-lg font-black leading-none text-brand-400">{queue.loading && !queue.data ? '-' : `~${wait}m`}</span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Est. wait</span>
          </div>
        </div>
      </section>

      {settings.announcementActive && settings.announcement && (
        <div className="mx-4 mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800">
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0" /> {settings.announcement}
        </div>
      )}

      {/* ================= BARBERS ================= */}
      <section className="pt-8">
        <SectionHead eyebrow="The team" title="Meet your barbers" />
        <Strip>
          {(barbers.data || []).map((b, i) => {
            const img = b.avatar?.url || barberShots[i % Math.max(1, barberShots.length)]?.url;
            return (
              <Link key={b._id} href={`/book?barberId=${b._id}`} className="relative aspect-[3/4] w-[46%] shrink-0 snap-start overflow-hidden rounded-2xl bg-slate-200 first:ml-0">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={b.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-brand-100 text-4xl font-black text-brand-700">{initials(b.name)}</div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent p-3 pt-10 text-white">
                  <p className="text-base font-extrabold leading-tight">{b.name}</p>
                  <p className="text-[11px] text-slate-300">{b.title || 'Barber'}</p>
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold backdrop-blur">Book <ChevronRight className="h-3 w-3" /></span>
                </div>
              </Link>
            );
          })}
          {barbers.loading && [0, 1].map((i) => <div key={i} className="skeleton aspect-[3/4] w-[46%] shrink-0 rounded-2xl" />)}
        </Strip>
      </section>

      {/* ================= SERVICES ================= */}
      <section className="px-4 pt-9">
        <SectionHead eyebrow="Menu" title="Services & pricing" className="px-0" action={<span className="text-[11px] font-semibold text-slate-400">Pay at salon</span>} />
        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {services.loading && [0, 1, 2].map((i) => <div key={i} className="skeleton my-3 h-10" />)}
          {(services.data || []).map((s) => (
            <Link key={s._id} href={`/book?serviceId=${s._id}`} className="flex items-center gap-3 py-3.5 active:bg-slate-100">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
                  {s.name}
                  {s.popular && <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[9px] font-extrabold uppercase text-white"><Sparkles className="h-2.5 w-2.5" /> Popular</span>}
                </p>
                <p className="truncate text-xs text-slate-500">{s.duration} min{s.description ? ` • ${s.description}` : ''}</p>
              </div>
              <div className="text-right">
                <p className="text-base font-black text-slate-900">{money(s.price)}</p>
                {s.compareAtPrice && s.compareAtPrice > s.price ? <p className="text-[11px] text-slate-400 line-through">{money(s.compareAtPrice)}</p> : null}
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </Link>
          ))}
        </div>
      </section>

      {/* ================= CUTTING DEMO ================= */}
      {(demoVideos.length > 0 || demoImages.length > 0) && (
        <section className="pt-9">
          <SectionHead eyebrow="In action" title="Watch the craft" />
          {demoVideos.length > 0 ? (
            <Strip>
              {demoVideos.map((v, i) => (
                <div key={v._id || v.url} className="relative aspect-[9/16] w-[70%] shrink-0 snap-center overflow-hidden rounded-2xl bg-black">
                  <video src={v.url} controls playsInline preload="metadata" className="h-full w-full object-cover" />
                  {v.caption && <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/50 px-2 py-1 text-[11px] font-semibold text-white">{v.caption}</span>}
                </div>
              ))}
              {demoImages.map((m, i) => (
                <MediaThumb key={m._id || m.url} m={m} className="aspect-[9/16] w-[70%] shrink-0 snap-center" onClick={() => openLb(demoImages, i)} />
              ))}
            </Strip>
          ) : (
            <Strip>
              {demoImages.map((m, i) => (
                <MediaThumb key={m._id || m.url} m={m} className="aspect-[4/5] w-[62%] shrink-0 snap-center" onClick={() => openLb(demoImages, i)} />
              ))}
            </Strip>
          )}
        </section>
      )}

      {/* ================= LOOKBOOK ================= */}
      {styles.length > 0 && (
        <section className="px-4 pt-9">
          <SectionHead eyebrow="Lookbook" title="Cut designs & styles" className="px-0" action={<span className="text-[11px] font-semibold text-slate-400">{styles.length} looks</span>} />
          <div className="grid grid-cols-2 gap-2">
            {visibleStyles.map((m, i) => (
              <MediaThumb key={m._id || m.url} m={m} onClick={() => openLb(styles, i)} className={cn(i % 5 === 0 ? 'col-span-2 aspect-[16/9]' : 'aspect-square')} />
            ))}
          </div>
          {styles.length > 7 && (
            <button onClick={() => setShowAllStyles((v) => !v)} className="btn-secondary mt-3 w-full">
              {showAllStyles ? 'Show less' : `See all ${styles.length} styles`}
            </button>
          )}
          <p className="mt-3 text-center text-xs text-slate-500">Found a look you like? Mention it in the booking note.</p>
        </section>
      )}

      {/* ================= THE SHOP ================= */}
      <section className="pt-9">
        <SectionHead eyebrow="Visit" title="The shop" />
        {shop.length > 0 && (
          <Strip className="mb-4">
            {shop.map((m, i) => (
              <MediaThumb key={m._id || m.url} m={m} className="aspect-[4/3] w-[78%] shrink-0 snap-center" onClick={() => openLb(shop, i)} />
            ))}
          </Strip>
        )}
        <div className="px-4">
          {settings.about && <p className="text-sm leading-relaxed text-slate-600">{settings.about}</p>}
          <ul className="mt-4 divide-y divide-slate-200 border-y border-slate-200 text-sm">
            {settings.address && (
              <li className="flex items-start gap-3 py-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <span className="text-slate-700">{settings.address}</span>
              </li>
            )}
            <li className="flex items-start gap-3 py-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span className="text-slate-700">
                {fmtTime(settings.openTime)} - {fmtTime(settings.closeTime)}
                {settings.weeklyOff.length > 0 && <span className="block text-xs text-slate-400">Closed on {settings.weeklyOff.map((d) => WEEKDAYS[d]).join(', ')}</span>}
              </span>
            </li>
            {settings.phone && (
              <li className="flex items-start gap-3 py-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <a href={`tel:${settings.phone}`} className="font-semibold text-slate-800">{settings.phone}</a>
              </li>
            )}
            <li className="flex items-start gap-3 py-3">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span className="text-slate-700">{barbers.data?.length || 0} barber{(barbers.data?.length || 0) === 1 ? '' : 's'} &bull; walk-ins welcome, tokens first</span>
            </li>
          </ul>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {settings.phone && (
              <a href={`tel:${settings.phone}`} className="btn-secondary flex-col gap-1 py-3 text-[11px]"><Phone className="h-4 w-4 text-brand-600" /> Call</a>
            )}
            {(settings.whatsapp || settings.phone) && (
              <a href={waLink(settings.whatsapp || settings.phone, `Hi ${settings.salonName}, I want to book a slot.`)} target="_blank" rel="noreferrer" className="btn-secondary flex-col gap-1 py-3 text-[11px]"><MessageCircle className="h-4 w-4 text-brand-600" /> WhatsApp</a>
            )}
            {settings.mapUrl ? (
              <a href={settings.mapUrl} target="_blank" rel="noreferrer" className="btn-secondary flex-col gap-1 py-3 text-[11px]"><Navigation className="h-4 w-4 text-brand-600" /> Directions</a>
            ) : (
              <Link href="/book" className="btn-primary flex-col gap-1 py-3 text-[11px]"><Scissors className="h-4 w-4" /> Book</Link>
            )}
          </div>
        </div>
      </section>

      {/* ================= FOOTER CTA ================= */}
      <section className="mx-4 mt-9 rounded-3xl bg-gradient-to-br from-brand-600 to-teal-700 p-5 text-white shadow-lg shadow-brand-600/20">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-100">Ready?</p>
        <h3 className="mt-1 text-2xl font-black leading-tight">Your chair is one tap away.</h3>
        <p className="mt-1 text-sm text-brand-100">Get a token now and track your turn live on your phone.</p>
        <Link href="/book" className="btn mt-4 w-full bg-white py-3 text-brand-700">Book a slot <ArrowRight className="h-4 w-4" /></Link>
      </section>
      <p className="px-4 pb-4 pt-6 text-center text-[11px] text-slate-400">
        &copy; {new Date().getFullYear()} {settings.salonName}
        <span className="mt-1 block">Made by Tufan Mandal</span>
      </p>

      <Lightbox items={lb.items} index={lb.index} onClose={() => setLb({ items: [], index: null })} onIndex={(i) => setLb((s) => ({ ...s, index: i }))} />
    </AppShell>
  );
}
