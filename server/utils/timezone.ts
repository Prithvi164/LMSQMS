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

// Add new function specifically for handling date-only values
export function formatISTDateOnly(dateStr: string): string {
  const date = new Date(dateStr);
  
  return date.toLocaleString('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split(',')[0]; // Remove any time component
}

// Function to convert date string to UTC midnight for storage
// This ensures dates are stored without time component
export function toUTCStorage(dateStr: string): string {
  // Parse the date string
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD');
  }
  
  // Create date with time set to midnight in UTC
  const date = new Date(Date.UTC(
    parseInt(parts[0]), // Year
    parseInt(parts[1]) - 1, // Month (0-indexed)
    parseInt(parts[2]), // Day
    0, 0, 0, 0 // Hours, minutes, seconds, milliseconds
  ));
  
  return date.toISOString().split('T')[0]; // Return only YYYY-MM-DD part
}