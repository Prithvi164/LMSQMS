import { formatToIST } from './lib/date-utils';

// Test the formatToIST function
const testDate = '2025-03-27T10:30:00.000Z';
const formattedDate = formatToIST(testDate);
console.log(`Original date: ${testDate}`);
console.log(`Formatted date: ${formattedDate}`);