import { addDays, format } from 'date-fns';

interface ProcessConfig {
  inductionDays: number;
  trainingDays: number;
  certificationDays: number;
  ojtDays: number;
  ojtCertificationDays: number;
}

export interface BatchDates {
  startDate: string;
  endDate: string;
  inductionStartDate: string | null;
  inductionEndDate: string | null;
  trainingStartDate: string | null;
  trainingEndDate: string | null;
  certificationStartDate: string | null;
  certificationEndDate: string | null;
  ojtStartDate: string | null;
  ojtEndDate: string | null;
  ojtCertificationStartDate: string | null;
  ojtCertificationEndDate: string | null;
  handoverToOpsDate: string;
}

export function calculateBatchDates(startDate: Date, processConfig: ProcessConfig): BatchDates {
  const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');
  let currentDate = startDate;

  // Initialize all dates as null
  const dates: BatchDates = {
    startDate: formatDate(startDate),
    endDate: '', // Will be set at the end
    inductionStartDate: null,
    inductionEndDate: null,
    trainingStartDate: null,
    trainingEndDate: null,
    certificationStartDate: null,
    certificationEndDate: null,
    ojtStartDate: null,
    ojtEndDate: null,
    ojtCertificationStartDate: null,
    ojtCertificationEndDate: null,
    handoverToOpsDate: '', // Will be set at the end
  };

  // Handle Induction Phase
  if (processConfig.inductionDays > 0) {
    dates.inductionStartDate = formatDate(currentDate);
    dates.inductionEndDate = formatDate(addDays(currentDate, processConfig.inductionDays - 1));
    currentDate = new Date(dates.inductionEndDate);
  }

  // Handle Training Phase
  if (processConfig.trainingDays > 0) {
    dates.trainingStartDate = formatDate(currentDate);
    dates.trainingEndDate = formatDate(addDays(currentDate, processConfig.trainingDays - 1));
    currentDate = new Date(dates.trainingEndDate);
  }

  // Handle Certification Phase
  if (processConfig.certificationDays > 0) {
    dates.certificationStartDate = formatDate(currentDate);
    dates.certificationEndDate = formatDate(addDays(currentDate, processConfig.certificationDays - 1));
    currentDate = new Date(dates.certificationEndDate);
  }

  // Handle OJT Phase
  if (processConfig.ojtDays > 0) {
    dates.ojtStartDate = formatDate(currentDate);
    dates.ojtEndDate = formatDate(addDays(currentDate, processConfig.ojtDays - 1));
    currentDate = new Date(dates.ojtEndDate);
  }

  // Handle OJT Certification Phase
  if (processConfig.ojtCertificationDays > 0) {
    dates.ojtCertificationStartDate = formatDate(currentDate);
    dates.ojtCertificationEndDate = formatDate(addDays(currentDate, processConfig.ojtCertificationDays - 1));
    currentDate = new Date(dates.ojtCertificationEndDate);
  }

  // Set final dates
  dates.handoverToOpsDate = formatDate(currentDate);
  dates.endDate = dates.handoverToOpsDate;

  return dates;
}

// Helper function to check if a phase is active
export function isPhaseActive(dates: BatchDates, phase: keyof BatchDates): boolean {
  return dates[phase] !== null;
}

// Calculate progress percentage for a phase only if it's active
export function calculatePhaseProgress(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();

  if (today < start) return 0;
  if (today > end) return 100;

  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const daysCompleted = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  return Math.round((daysCompleted / totalDays) * 100);
}

// Function to validate if end date comes after start date
export function validateDateRange(startDate: string, endDate: string): boolean {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return end >= start;
}

// Function to calculate the current phase based on today's date
export function calculateCurrentPhase(dates: BatchDates): 'planned' | 'induction' | 'training' | 'certification' | 'ojt' | 'ojt_certification' | 'completed' {
  const today = new Date();
  const formatToDate = (dateStr: string) => new Date(dateStr);

  if (today < formatToDate(dates.startDate)) {
    return 'planned';
  } else if (today <= formatToDate(dates.inductionEndDate ?? dates.startDate)) { // Handle null inductionEndDate
    return 'induction';
  } else if (today <= formatToDate(dates.trainingEndDate ?? dates.startDate)) { // Handle null trainingEndDate
    return 'training';
  } else if (today <= formatToDate(dates.certificationEndDate ?? dates.startDate)) { // Handle null certificationEndDate
    return 'certification';
  } else if (today <= formatToDate(dates.ojtEndDate ?? dates.startDate)) { // Handle null ojtEndDate
    return 'ojt';
  } else if (today <= formatToDate(dates.ojtCertificationEndDate ?? dates.startDate)) { // Handle null ojtCertificationEndDate
    return 'ojt_certification';
  } else {
    return 'completed';
  }
}