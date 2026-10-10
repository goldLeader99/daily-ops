/** Uses the dashboard's shared clock so both views stay in sync across midnight/resume. */
export function Clock({ now }: { now: Date }) {
  return (
    <div className="clock-face">
      <div className="clock-face-weekday">
        {now.toLocaleDateString('en-CA', { weekday: 'long' }).toUpperCase()}
      </div>
      <time className="clock-face-time" dateTime={now.toISOString()}>
        <span>{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
        <span className="clock-face-seconds">{String(now.getSeconds()).padStart(2, '0')}</span>
      </time>
      <div className="clock-face-date">
        {now
          .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          .toUpperCase()}
      </div>
    </div>
  );
}
