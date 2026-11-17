import { buildSchedule } from '../../../../utils/eventSchedule';

/** Date, start time and end time inputs shared by the New Event and Edit Event forms. */
function EventScheduleFields({ form, update }) {
  const schedule = buildSchedule(form.eventDate, form.startTime, form.endTime);

  return (
    <>
      <label>
        Event date
        <input type="date" value={form.eventDate} onChange={update('eventDate')} />
      </label>

      <div className="auth-row">
        <label>
          Start time
          <input type="time" value={form.startTime} onChange={update('startTime')} />
        </label>
        <label>
          End time
          <input type="time" value={form.endTime} onChange={update('endTime')} />
        </label>
      </div>
      <p className="auth-hint">
        {schedule.error ||
          (form.endTime
            ? `The event closes to guests automatically at the end time${
                schedule.endsNextDay ? ', on the following day' : ''
              }.`
            : 'Optional. Set an end time to close the event to guests automatically.')}
      </p>
    </>
  );
}

export default EventScheduleFields;
