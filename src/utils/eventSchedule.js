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

const padTime = (n) => String(n).padStart(2, '0');

/** "18:30" for a time input, in local time. */
export function toTimeInputValue(value) {
  const date = parseEventDate(value);
  if (!date) return '';
  return `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
}

/** Earliest end time the picker will allow after a given start time. */
export function minEndTime(startTime) {
  if (!startTime) return '';
  const [hours, minutes] = String(startTime).split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return '';
  if (hours === 23 && minutes === 59) return '';
  const next = new Date(2000, 0, 1, hours, minutes + 1);
  return `${padTime(next.getHours())}:${padTime(next.getMinutes())}`;
}

/**
 * Turns the form's date and time fields into the start and end moments.
 * End time must be later than start time on the same date.
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

  if (start && end && end <= start) {
    return {
      ...empty,
      error: 'End time must be after start time on the same day.',
    };
  }

  return {
    startsAt: start ? start.toISOString() : null,
    endsAt: end ? end.toISOString() : null,
    endsNextDay: false,
    error: '',
  };
}

export function formatEventTime(value) {
  const date = parseEventDate(value);
  if (!date) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function withoutMeridiem(label) {
  return label.replace(/\s*(AM|PM|am|pm|a\.m\.|p\.m\.)$/i, '').trim();
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

/** "6:00 – 11:00 PM", "From 6:00 PM", "Until 11:00 PM", or '' when no times are set. */
export function formatEventTimeRange(event) {
  const startDate = parseEventDate(event?.startsAt);
  const endDate = parseEventDate(event?.endsAt);
  const start = startDate ? formatEventTime(event.startsAt) : '';
  const end = endDate ? formatEventTime(event.endsAt) : '';
  if (start && end) {
    const sameHalf =
      startDate.getHours() < 12 === endDate.getHours() < 12
      && withoutMeridiem(start) !== start;
    return sameHalf ? `${withoutMeridiem(start)} – ${end}` : `${start} – ${end}`;
  }
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return '';
}
