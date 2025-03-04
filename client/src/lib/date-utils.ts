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
  inductionStartDate: string;
  inductionEndDate: string;
  trainingStartDate: string;
  trainingEndDate: string;
  certificationStartDate: string;
  certificationEndDate: string;
  ojtStartDate: string;
  ojtEndDate: string;
  ojtCertificationStartDate: string;
  ojtCertificationEndDate: string;
  handoverToOpsDate: string;
}

export function calculateBatchDates(startDate: Date, processConfig: ProcessConfig): BatchDates {
  // Format dates to string in YYYY-MM-DD format
  const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');

  // Start with induction phase
  let currentDate = startDate;
  const inductionStartDate = currentDate;
  const inductionEndDate = processConfig.inductionDays > 0 
    ? addDays(currentDate, processConfig.inductionDays - 1)
    : currentDate;

  // Training phase starts on the same day as induction ends if inductionDays is 0
  currentDate = inductionEndDate;
  const trainingStartDate = currentDate;
  const trainingEndDate = processConfig.trainingDays > 0 
    ? addDays(currentDate, processConfig.trainingDays - 1) 
    : currentDate;

  // Certification phase
  currentDate = trainingEndDate;
  const certificationStartDate = currentDate;
  const certificationEndDate = processConfig.certificationDays > 0 
    ? addDays(currentDate, processConfig.certificationDays - 1)
    : currentDate;

  // OJT phase
  currentDate = certificationEndDate;
  const ojtStartDate = currentDate;
  const ojtEndDate = processConfig.ojtDays > 0 
    ? addDays(currentDate, processConfig.ojtDays - 1)
    : currentDate;

  // OJT Certification phase
  currentDate = ojtEndDate;
  const ojtCertificationStartDate = currentDate;
  const ojtCertificationEndDate = processConfig.ojtCertificationDays > 0 
    ? addDays(currentDate, processConfig.ojtCertificationDays - 1)
    : currentDate;

  // Handover happens on the same day as OJT certification ends if no gap is needed
  const handoverToOpsDate = ojtCertificationEndDate;

  // Calculate total duration and end date
  const endDate = handoverToOpsDate;

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    inductionStartDate: formatDate(inductionStartDate),
    inductionEndDate: formatDate(inductionEndDate),
    trainingStartDate: formatDate(trainingStartDate),
    trainingEndDate: formatDate(trainingEndDate),
    certificationStartDate: formatDate(certificationStartDate),
    certificationEndDate: formatDate(certificationEndDate),
    ojtStartDate: formatDate(ojtStartDate),
    ojtEndDate: formatDate(ojtEndDate),
    ojtCertificationStartDate: formatDate(ojtCertificationStartDate),
    ojtCertificationEndDate: formatDate(ojtCertificationEndDate),
    handoverToOpsDate: formatDate(handoverToOpsDate),
  };
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
  } else if (today <= formatToDate(dates.inductionEndDate)) {
    return 'induction';
  } else if (today <= formatToDate(dates.trainingEndDate)) {
    return 'training';
  } else if (today <= formatToDate(dates.certificationEndDate)) {
    return 'certification';
  } else if (today <= formatToDate(dates.ojtEndDate)) {
    return 'ojt';
  } else if (today <= formatToDate(dates.ojtCertificationEndDate)) {
    return 'ojt_certification';
  } else {
    return 'completed';
  }
}

// Calculate progress percentage for a phase
export function calculatePhaseProgress(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();

  if (today < start) return 0;
  if (today > end) return 100;

  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const daysCompleted = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  return Math.round((daysCompleted / totalDays) * 100);
}