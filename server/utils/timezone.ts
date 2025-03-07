const TIMEZONE = 'Asia/Kolkata';

export function toIST(date: Date | string): Date {
  const utcDate = typeof date === 'string' ? new Date(date) : date;
  return new Date(utcDate.toLocaleString('en-US', { timeZone: TIMEZONE }));
}

export function formatIST(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', { 
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

export function getCurrentISTTime(): Date {
  return toIST(new Date());
}

export const TIMEZONE_CONFIG = {
  timezone: TIMEZONE,
  offset: '+05:30'
};