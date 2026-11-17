import { parseEventDate } from '../../../../utils/eventSchedule';

export function formatShortEventDate(value) {
  const date = parseEventDate(value);
  if (!date) return null;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatLongEventDate(value) {
  const date = parseEventDate(value);
  if (!date) return '—';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
