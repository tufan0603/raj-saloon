'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { Download, Share2, Copy, QrCode, Check, RefreshCw, Printer, Settings as SettingsIcon } from 'lucide-react';
import { AdminShell } from '@/components/admin';
import { Button, Field, Input, SectionTitle, Segmented, Toggle } from '@/components/ui';
import { useToast } from '@/components/toast';
import { useSettings } from '@/lib/settings-context';
import { LOCAL_LOGO } from '@/components/brand';
import { drawShopCard, downloadCanvas, downloadDataUrl, CARD_H, CARD_W, type CardTheme } from '@/lib/card';
import { fmtTime, WEEKDAYS } from '@/lib/utils';
import { copyText } from '@/lib/upi';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'salon';

export default function QrCardPage() {
  const { settings } = useSettings();
  const toast = useToast();
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const url = (settings.siteUrl || origin || '').replace(/\/$/, '') + '/';

  // ---------- plain QR ----------
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!url || url === '/') return;
    QRCode.toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0f172a', light: '#ffffff' } }).then(setQr).catch(() => setQr(''));
  }, [url]);

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: settings.salonName, text: `Book your slot at ${settings.salonName}`, url });
      else {
        await copyText(url);
        toast.success('Link copied');
      }
    } catch {}
  };

  // ---------- shop card ----------
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [theme, setTheme] = useState<CardTheme>('cream');
  const [headline, setHeadline] = useState('Scan to book your slot');
  const [footer, setFooter] = useState('Book online  |  Track your turn live  |  Pay by UPI or cash');
  const [showHours, setShowHours] = useState(true);
  const [showAddress, setShowAddress] = useState(true);
  const [showPhone, setShowPhone] = useState(true);
  const [useLogo, setUseLogo] = useState(true);
  const [rendering, setRendering] = useState(false);

  const hours = `${fmtTime(settings.openTime)} - ${fmtTime(settings.closeTime)}`;
  const offDays = settings.weeklyOff.length ? `Closed on ${settings.weeklyOff.map((d) => WEEKDAYS[d]).join(', ')}` : '';
  const logoUrl = useLogo ? settings.logo?.url || LOCAL_LOGO : null;

  const opts = useMemo(
    () => ({ salonName: settings.salonName, tagline: settings.tagline, headline, url, hours, offDays, address: settings.address, phone: settings.phone || settings.whatsapp, footer, logoUrl, theme, showAddress, showPhone, showHours }),
    [settings, headline, url, hours, offDays, footer, logoUrl, theme, showAddress, showPhone, showHours],
  );

  const render = useCallback(async () => {
    if (!canvasRef.current || !url || url === '/') return;
    setRendering(true);
    try {
      await drawShopCard(canvasRef.current, opts);
    } catch (e: any) {
      toast.error(e?.message || 'Could not render card');
    } finally {
      setRendering(false);
    }
  }, [opts, url, toast]);

  useEffect(() => {
    const t = setTimeout(render, 150);
    return () => clearTimeout(t);
  }, [render]);

  const downloadCard = () => canvasRef.current && downloadCanvas(canvasRef.current, `${slug(settings.salonName)}-card-${theme}.png`);
  const printCard = () => {
    const data = canvasRef.current?.toDataURL('image/png');
    if (!data) return;
    const w = window.open('', '_blank');
    if (!w) return toast.error('Allow pop-ups to print');
    w.document.write(`<html><head><title>${settings.salonName} card</title><style>@page{margin:0}body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh}img{width:100%;max-width:148mm;height:auto}</style></head><body><img src="${data}" onload="setTimeout(()=>{window.print();},300)"></body></html>`);
    w.document.close();
  };

  return (
    <AdminShell title="QR & Shop Card" back="/admin/more" subtitle="Print, share or stick it at the counter">
      <div className="space-y-4">
        <div className="card space-y-3">
          <SectionTitle title="Your booking link" icon={<QrCode className="h-4 w-4 text-brand-600" />} action={<Link href="/admin/settings" className="flex items-center gap-1 text-[11px] font-bold text-brand-600"><SettingsIcon className="h-3 w-3" /> Change</Link>} />
          <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <span className="truncate font-mono text-xs font-bold text-slate-800">{url}</span>
            <button onClick={async () => { if (await copyText(url)) { setCopied(true); toast.success('Link copied'); } }} className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-slate-600 shadow-sm">
              {copied ? <Check className="h-3 w-3 text-brand-600" /> : <Copy className="h-3 w-3" />} Copy
            </button>
          </div>
          {!settings.siteUrl && <p className="text-[11px] text-amber-700">Tip: set the live website URL in Salon settings so the QR works even when you generate it from localhost.</p>}
          <div className="mx-auto w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR code to the booking site" className="h-full w-full" />
            ) : (
              <div className="skeleton aspect-square" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => qr && downloadDataUrl(qr, `${slug(settings.salonName)}-qr.png`)} disabled={!qr}><Download className="h-4 w-4" /> Download QR</Button>
            <Button variant="secondary" onClick={share}><Share2 className="h-4 w-4" /> Share link</Button>
          </div>
        </div>

        <div className="card space-y-3">
          <SectionTitle title="Shop card designer" action={<button onClick={render} className={rendering ? 'animate-spin text-slate-400' : 'text-slate-400'} aria-label="Re-render"><RefreshCw className="h-4 w-4" /></button>} />
          <Segmented<CardTheme> value={theme} onChange={setTheme} options={[{ value: 'cream', label: 'Classic' }, { value: 'dark', label: 'Dark' }, { value: 'emerald', label: 'Emerald' }]} />
          <Field label="Headline"><Input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={40} /></Field>
          <Field label="Footer line"><Input value={footer} onChange={(e) => setFooter(e.target.value)} maxLength={80} /></Field>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3">
            <Toggle checked={useLogo} onChange={setUseLogo} label="Logo" />
            <Toggle checked={showHours} onChange={setShowHours} label="Opening hours" />
            <Toggle checked={showAddress} onChange={setShowAddress} label="Address" />
            <Toggle checked={showPhone} onChange={setShowPhone} label="Phone" />
          </div>
          <p className="text-[11px] text-slate-500">Name, tagline, hours, address and phone come from Content and Salon settings. Edit them there and come back.</p>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner">
            <canvas ref={canvasRef} width={CARD_W} height={CARD_H} className="block h-auto w-full" style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={downloadCard} loading={rendering} className="whitespace-nowrap"><Download className="h-4 w-4" /> Download</Button>
            <Button variant="secondary" onClick={printCard} className="whitespace-nowrap"><Printer className="h-4 w-4" /> Print</Button>
          </div>
          <p className="text-[11px] text-slate-400">PNG, {CARD_W} x {CARD_H} px (A-size ratio). Perfect for WhatsApp status, Instagram, or A6 / A5 printing at the counter.</p>
        </div>
      </div>
    </AdminShell>
  );
}
