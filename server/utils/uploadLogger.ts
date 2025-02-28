import { z } from "zod";

// Define log entry types
export type UploadLogEntry = {
  timestamp: Date;
  rowNumber: number;
  action: string;
  status: 'success' | 'error';
  details: string;
  data?: Record<string, any>;
  error?: {
    type: string;
    message: string;
    stack?: string;
  };
};

// Define error types for better categorization
export const UploadErrorType = {
  VALIDATION: 'VALIDATION_ERROR',
  DATABASE: 'DATABASE_ERROR',
  PROCESS: 'PROCESS_ERROR',
  USER: 'USER_ERROR',
  PERMISSION: 'PERMISSION_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
} as const;

// Logger class to handle upload related logging
export class UploadLogger {
  private logs: UploadLogEntry[] = [];
  private batchId: string;

  constructor() {
    this.batchId = new Date().getTime().toString();
  }

  private addLog(log: UploadLogEntry) {
    this.logs.push(log);
    // Log to console for immediate feedback
    console.log(`[Bulk Upload][${log.status}] Row ${log.rowNumber}: ${log.action} - ${log.details}`);
    if (log.error) {
      console.error('Error details:', log.error);
    }
  }

  logSuccess(rowNumber: number, action: string, details: string, data?: Record<string, any>) {
    this.addLog({
      timestamp: new Date(),
      rowNumber,
      action,
      status: 'success',
      details,
      data
    });
  }

  logError(rowNumber: number, action: string, error: Error, errorType: keyof typeof UploadErrorType, data?: Record<string, any>) {
    this.addLog({
      timestamp: new Date(),
      rowNumber,
      action,
      status: 'error',
      details: error.message,
      data,
      error: {
        type: UploadErrorType[errorType],
        message: error.message,
        stack: error.stack
      }
    });
  }

  getBatchSummary() {
    const successful = this.logs.filter(log => log.status === 'success').length;
    const failed = this.logs.filter(log => log.status === 'error').length;
    const errorsByType = this.logs
      .filter(log => log.status === 'error')
      .reduce((acc, log) => {
        const type = log.error?.type || 'UNKNOWN_ERROR';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return {
      batchId: this.batchId,
      timestamp: new Date(),
      totalProcessed: this.logs.length,
      successful,
      failed,
      errorsByType,
      logs: this.logs
    };
  }

  clear() {
    this.logs = [];
  }
}
