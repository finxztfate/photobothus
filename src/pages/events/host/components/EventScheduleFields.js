import { buildSchedule, minEndTime } from '../../../../utils/eventSchedule';

/** Date, start time and end time inputs shared by the New Event and Edit Event forms. */
function EventScheduleFields({ form, update }) {
  const schedule = buildSchedule(form.eventDate, form.startTime, form.endTime);
  const endMin = minEndTime(form.startTime);

  return (
    <>
      <label>
        Event date
        <input type="date" value={form.eventDate} onChange={update('eventDate')} required />
      </label>

      <div className="auth-row">
        <label>
          Start time
          <input
            type="time"
            value={form.startTime}
            onChange={update('startTime')}
            required
            max={form.endTime || undefined}
          />
        </label>
        <label>
          End time
          <input
            type="time"
            value={form.endTime}
            onChange={update('endTime')}
            required
            min={endMin || undefined}
          />
        </label>
      </div>
      <p className={`auth-hint${schedule.error ? ' is-error' : ''}`}>
        {schedule.error || 'The event closes to guests automatically at the end time.'}
      </p>
    </>
  );
}

export default EventScheduleFields;
