/**
 * Time label of a chat row (CMP-09, D-109): today's time, "Yesterday", the weekday within seven
 * days, otherwise the date. Times follow the device's locale and time zone, so the formatters are
 * created with no explicit locale unless a caller (a test) passes one.
 */
import { strings } from '../strings';

type FormatterOptions = {
  locale?: string;
  timeZone?: string;
};

function daysBetweenLocalDates(earlier: Date, later: Date, opts: FormatterOptions): number {
  const parts = new Intl.DateTimeFormat(opts.locale ?? 'en-US', {
    timeZone: opts.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  function dayNumber(value: Date): number {
    const fields = parts.formatToParts(value);
    const get = (type: Intl.DateTimeFormatPartTypes): number => {
      const part = fields.find((candidate) => candidate.type === type);
      return part ? Number(part.value) : 0;
    };
    return Date.UTC(get('year'), get('month') - 1, get('day'));
  }

  return Math.round((dayNumber(later) - dayNumber(earlier)) / 86_400_000);
}

/** Formats an ISO timestamp for a chat row, or '' when it cannot be parsed. */
export function formatChatListTime(
  iso: string,
  now: Date,
  opts: FormatterOptions = {},
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const days = daysBetweenLocalDates(date, now, opts);

  if (days <= 0) {
    return new Intl.DateTimeFormat(opts.locale, {
      timeZone: opts.timeZone,
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }
  if (days === 1) return strings.chatList.yesterday;
  if (days < 7) {
    return new Intl.DateTimeFormat(opts.locale, {
      timeZone: opts.timeZone,
      weekday: 'short',
    }).format(date);
  }
  return new Intl.DateTimeFormat(opts.locale, {
    timeZone: opts.timeZone,
    dateStyle: 'medium',
  }).format(date);
}
