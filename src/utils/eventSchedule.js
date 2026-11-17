// Helpers for an event's date, start time and end time.
// The date is a plain calendar day ("2026-11-20"); start and end are exact
// moments (ISO strings) shown in the viewer's local time.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses an event date or timestamp. A plain calendar day is read as that day locally. */
export function parseEventDate(value) {
  if (!value) return null;
  const match = DATE_ONLY.exec(String(value));
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "18:30" for a time input, in local time. */
export function toTimeInputValue(value) {
  const date = parseEventDate(value);
  if (!date) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Turns the form's date and time fields into the start and end moments.
 * An end time at or before the start time means the event runs past midnight.
 */
export function buildSchedule(eventDate, startTime, endTime) {
  const empty = { startsAt: null, endsAt: null, endsNextDay: false, error: '' };
  if (!startTime && !endTime) return empty;
  if (!eventDate) {
    return { ...empty, error: 'Pick an event date to set a start or end time.' };
  }

  const start = startTime ? new Date(`${eventDate}T${startTime}`) : null;
  const end = endTime ? new Date(`${eventDate}T${endTime}`) : null;
  if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) {
    return { ...empty, error: 'Enter a valid date and time.' };
  }

  let endsNextDay = false;
  if (start && end && end <= start) {
    end.setDate(end.getDate() + 1);
    endsNextDay = true;
  }

  return {
    startsAt: start ? start.toISOString() : null,
    endsAt: end ? end.toISOString() : null,
    endsNextDay,
    error: '',
  };
}

export function formatEventTime(value) {
  const date = parseEventDate(value);
  if (!date) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "Fri, Nov 20, 11:00 PM" */
export function formatEventDateTime(value) {
  const date = parseEventDate(value);
  if (!date) return '';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "6:00 PM – 11:00 PM", "From 6:00 PM", "Until 11:00 PM", or '' when no times are set. */
export function formatEventTimeRange(event) {
  const start = formatEventTime(event?.startsAt);
  const end = formatEventTime(event?.endsAt);
  if (start && end) return `${start} – ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return '';
}
