import { buildSchedule, parseEventDate, toTimeInputValue } from './eventSchedule';

describe('buildSchedule', () => {
  test('no times means no schedule', () => {
    expect(buildSchedule('2026-11-20', '', '')).toEqual({
      startsAt: null,
      endsAt: null,
      endsNextDay: false,
      error: '',
    });
  });

  test('a time without a date is rejected', () => {
    expect(buildSchedule('', '18:00', '').error).toMatch(/pick an event date/i);
  });

  test('start and end on the same day', () => {
    const schedule = buildSchedule('2026-11-20', '18:00', '23:00');
    expect(new Date(schedule.startsAt)).toEqual(new Date(2026, 10, 20, 18, 0));
    expect(new Date(schedule.endsAt)).toEqual(new Date(2026, 10, 20, 23, 0));
    expect(schedule.endsNextDay).toBe(false);
  });

  test('an end time before the start time rolls over to the next day', () => {
    const schedule = buildSchedule('2026-11-20', '20:00', '01:00');
    expect(new Date(schedule.endsAt)).toEqual(new Date(2026, 10, 21, 1, 0));
    expect(schedule.endsNextDay).toBe(true);
  });

  test('an end time alone stays on the event date', () => {
    const schedule = buildSchedule('2026-11-20', '', '01:00');
    expect(schedule.startsAt).toBeNull();
    expect(new Date(schedule.endsAt)).toEqual(new Date(2026, 10, 20, 1, 0));
  });

  test('times survive a round trip through the edit form', () => {
    const schedule = buildSchedule('2026-11-20', '20:00', '01:00');
    expect(toTimeInputValue(schedule.startsAt)).toBe('20:00');
    expect(toTimeInputValue(schedule.endsAt)).toBe('01:00');
  });
});

describe('parseEventDate', () => {
  test('a plain calendar day is that day in local time', () => {
    const date = parseEventDate('2026-11-20');
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 10, 20]);
  });

  test('empty and invalid values are null', () => {
    expect(parseEventDate('')).toBeNull();
    expect(parseEventDate('not a date')).toBeNull();
  });
});
