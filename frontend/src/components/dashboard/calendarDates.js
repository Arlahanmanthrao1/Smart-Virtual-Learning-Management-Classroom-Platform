export function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function monthDays(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  // Monday first. Use local calendar arithmetic, not fixed 24-hour increments (DST).
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) =>
    new Date(month.getFullYear(), month.getMonth(), 1 - offset + index));
}

export function monthRange(month) {
  return {
    start: new Date(month.getFullYear(), month.getMonth(), 1).toISOString(),
    end: new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString(),
  };
}

export function groupEvents(events) {
  return events.reduce((days, event) => {
    const key = dayKey(new Date(event.starts_at));
    (days[key] ||= []).push(event);
    return days;
  }, {});
}
