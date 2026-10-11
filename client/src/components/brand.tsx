'use client';
import { useState } from 'react';
import { Scissors } from 'lucide-react';
import { useSettings } from '@/lib/settings-context';
import { cn } from '@/lib/utils';

/** Local logo file (client/public/brand/logo.png). Admin -> Content -> Upload logo overrides it. */
export const LOCAL_LOGO = '/brand/logo.png';

/**
 * The salon logo, used in the header, auth screens, install banner and 404.
 * Order: logo uploaded in admin -> /brand/logo.png -> scissors mark.
 */
export function BrandLogo({ size = 36, className, shape = 'rounded-full' }: { size?: number; className?: string; shape?: 'rounded-full' | 'rounded-xl' | 'rounded-2xl' | 'rounded-none' }) {
  const { settings } = useSettings();
  const [failed, setFailed] = useState<string | null>(null);
  const uploaded = settings.logo?.url;
  const src = uploaded && failed !== uploaded ? uploaded : failed !== LOCAL_LOGO ? LOCAL_LOGO : null;

  if (!src) {
    return (
      <span className={cn('flex shrink-0 items-center justify-center bg-brand-600 text-white shadow-sm', shape, className)} style={{ width: size, height: size }} aria-hidden>
        <Scissors style={{ width: size * 0.5, height: size * 0.5 }} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={settings.salonName}
      width={size}
      height={size}
      onError={() => setFailed(src)}
      className={cn('shrink-0 bg-[#f8f3e7] object-contain shadow-sm', shape, className)}
      style={{ width: size, height: size }}
    />
  );
}
