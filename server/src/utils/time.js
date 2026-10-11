import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export { dayjs };

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Current moment in the salon timezone. */
export const nowIn = (tz) => dayjs().tz(tz);
/** Today's date string in the salon timezone. */
export const todayIn = (tz) => nowIn(tz).format('YYYY-MM-DD');
/** Minutes since midnight, salon timezone. */
export const nowMinutesIn = (tz) => {
  const n = nowIn(tz);
  return n.hour() * 60 + n.minute();
};
/** Minutes since midnight (salon tz) for an absolute Date. */
export const minutesOfDateIn = (d, tz) => {
  const x = dayjs(d).tz(tz);
  return x.hour() * 60 + x.minute();
};

export const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
export const fromMinutes = (mins) => {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const isValidDate = (d) => DATE_RE.test(d) && dayjs(d, 'YYYY-MM-DD', true).isValid();
export const weekdayOf = (date) => dayjs(date, 'YYYY-MM-DD').day();
export const addDays = (date, n) => dayjs(date, 'YYYY-MM-DD').add(n, 'day').format('YYYY-MM-DD');
export const diffDays = (from, to) => dayjs(to, 'YYYY-MM-DD').diff(dayjs(from, 'YYYY-MM-DD'), 'day');
