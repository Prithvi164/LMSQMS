import { addDays, format } from 'date-fns';

export interface Holiday {
  date: string;
  name: string;
  isRecurring?: boolean;
}

/**
 * Checks if a date is a weekly off day or a holiday
 * 
 * @param date The date to check
 * @param weeklyOffDays Array of days to be considered as off days (e.g., ['Saturday', 'Sunday'])
 * @param considerHolidays Whether to consider holidays
 * @param holidays Array of holiday objects with date and name
 * @returns Boolean indicating if the date is a non-working day
 */
export function isNonWorkingDay(
  date: Date,
  weeklyOffDays: string[] = ['Saturday', 'Sunday'],
  considerHolidays: boolean = true,
  holidays: Holiday[] = []
): boolean {
  // Get the day name (e.g., "Monday")
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Check if it's a weekly off day
  const isWeeklyOff = weeklyOffDays.includes(dayName);
  
  // If it's a weekly off day, return true immediately
  if (isWeeklyOff) {
    return true;
  }
  
  // Check if it's a holiday
  if (considerHolidays && holidays && holidays.length > 0) {
    const dateStr = format(date, 'yyyy-MM-dd');
    const isHoliday = holidays.some(holiday => {
      if (!holiday.date) return false;
      
      try {
        // Check if the holiday is the same date (for recurring holidays, ignore year)
        const holidayDate = new Date(holiday.date);
        
        if (holiday.isRecurring) {
          // For recurring holidays, just compare month and day
          return holidayDate.getMonth() === date.getMonth() && 
                 holidayDate.getDate() === date.getDate();
        } else {
          // For non-recurring holidays, compare the full date string
          const holidayDateStr = format(holidayDate, 'yyyy-MM-dd');
          const match = holidayDateStr === dateStr;
          if (match) {
            console.log(`Holiday match found: ${holiday.name} on ${dateStr}`);
          }
          return match;
        }
      } catch (error) {
        console.error(`Error comparing holiday date for ${holiday.name}:`, error);
        return false;
      }
    });
    
    if (isHoliday) {
      console.log(`Date ${dateStr} is a holiday`);
      return true;
    }
  }
  
  return false;
}

/**
 * Calculates working days considering weekly off days and holidays
 * 
 * @param startDate The start date
 * @param days Number of working days to add
 * @param weeklyOffDays Array of days to be considered as off days (e.g., ['Saturday', 'Sunday'])
 * @param considerHolidays Whether to consider holidays when calculating working days
 * @param holidays Array of holiday objects with date and name
 * @param isEndDate Whether it's an end date calculation (if true, subtracts 1 day from total)
 * @returns The calculated date after adding the specified number of working days
 */
export function calculateWorkingDays(
  startDate: Date,
  days: number,
  weeklyOffDays: string[] = ['Saturday', 'Sunday'],
  considerHolidays: boolean = true,
  holidays: Holiday[] = [],
  isEndDate: boolean = false
): Date {
  // For 0 days, return the start date as is
  if (days === 0) {
    return startDate;
  }

  // For end date calculation when days > 0, subtract 1 from days
  let daysToAdd = isEndDate ? days - 1 : days;
  let remainingDays = daysToAdd;
  let currentDate = new Date(startDate);

  while (remainingDays > 0) {
    // Move to the next day
    currentDate = addDays(currentDate, 1);
    
    // Check if the current date is a non-working day
    const isOffDay = isNonWorkingDay(currentDate, weeklyOffDays, considerHolidays, holidays);
    
    // Only count as a working day if it's not an off day
    if (!isOffDay) {
      remainingDays--;
    }
  }
  
  return currentDate;
}

/**
 * Calculate all phase dates for a batch based on process days
 * 
 * @param startDate The batch start date
 * @param phaseDurations Object with the duration of each phase in days
 * @param weeklyOffDays Array of days to be considered as off days
 * @param considerHolidays Whether to consider holidays
 * @param holidays Array of holiday objects
 * @returns Object with start and end dates for each phase
 */
/**
 * Finds the next working day from a given date
 * 
 * @param date The starting date
 * @param weeklyOffDays Array of days to be considered as off days
 * @param considerHolidays Whether to consider holidays
 * @param holidays Array of holiday objects
 * @returns The next working day
 */
export function findNextWorkingDay(
  date: Date,
  weeklyOffDays: string[] = ['Saturday', 'Sunday'],
  considerHolidays: boolean = true,
  holidays: Holiday[] = []
): Date {
  // Check if the given date is already a working day
  if (!isNonWorkingDay(date, weeklyOffDays, considerHolidays, holidays)) {
    return date;
  }
  
  // Keep adding days until we find a working day
  let currentDate = new Date(date);
  while (isNonWorkingDay(currentDate, weeklyOffDays, considerHolidays, holidays)) {
    currentDate = addDays(currentDate, 1);
  }
  
  return currentDate;
}

export function calculatePhaseDates({
  startDate,
  phaseDurations,
  weeklyOffDays = ['Saturday', 'Sunday'],
  considerHolidays = true,
  holidays = []
}: {
  startDate: Date | string;
  phaseDurations: {
    induction: number;
    training: number;
    certification: number;
    ojt: number;
    ojtCertification: number;
  };
  weeklyOffDays?: string[];
  considerHolidays?: boolean;
  holidays?: Holiday[];
}) {
  let start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  
  // Check if the start date is a non-working day (weekly off or holiday)
  // If so, find the next working day
  start = findNextWorkingDay(start, weeklyOffDays, considerHolidays, holidays);
  
  // Induction Phase
  const inductionStart = start;
  const inductionEnd = calculateWorkingDays(
    inductionStart,
    phaseDurations.induction,
    weeklyOffDays,
    considerHolidays,
    holidays,
    true
  );
  
  // Training Phase
  const trainingStart = phaseDurations.induction === 0 ? inductionEnd : 
    calculateWorkingDays(inductionEnd, 1, weeklyOffDays, considerHolidays, holidays);
  const trainingEnd = calculateWorkingDays(
    trainingStart,
    phaseDurations.training,
    weeklyOffDays,
    considerHolidays,
    holidays,
    true
  );
  
  // Certification Phase
  const certificationStart = phaseDurations.training === 0 ? trainingEnd : 
    calculateWorkingDays(trainingEnd, 1, weeklyOffDays, considerHolidays, holidays);
  const certificationEnd = calculateWorkingDays(
    certificationStart,
    phaseDurations.certification,
    weeklyOffDays,
    considerHolidays,
    holidays,
    true
  );
  
  // OJT Phase
  const ojtStart = phaseDurations.certification === 0 ? certificationEnd : 
    calculateWorkingDays(certificationEnd, 1, weeklyOffDays, considerHolidays, holidays);
  const ojtEnd = calculateWorkingDays(
    ojtStart,
    phaseDurations.ojt,
    weeklyOffDays,
    considerHolidays,
    holidays,
    true
  );
  
  // OJT Certification Phase
  const ojtCertificationStart = phaseDurations.ojt === 0 ? ojtEnd : 
    calculateWorkingDays(ojtEnd, 1, weeklyOffDays, considerHolidays, holidays);
  const ojtCertificationEnd = calculateWorkingDays(
    ojtCertificationStart,
    phaseDurations.ojtCertification,
    weeklyOffDays,
    considerHolidays,
    holidays,
    true
  );
  
  // Handover to Ops
  const handoverToOps = phaseDurations.ojtCertification === 0 ? ojtCertificationEnd : 
    calculateWorkingDays(ojtCertificationEnd, 1, weeklyOffDays, considerHolidays, holidays);
  
  return {
    inductionStart,
    inductionEnd,
    trainingStart,
    trainingEnd,
    certificationStart,
    certificationEnd,
    ojtStart,
    ojtEnd,
    ojtCertificationStart,
    ojtCertificationEnd,
    handoverToOps
  };
}