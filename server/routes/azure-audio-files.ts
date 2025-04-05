import { Router } from 'express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import multer from 'multer';
import { initAzureStorageService, AudioFileMetadata } from '../services/azureStorageService';
import { audioFileAllocations, audioFiles, audioLanguageEnum, users } from '../../shared/schema';
import { db } from '../db';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { read as readXLSX, utils as xlsxUtils, write as writeXLSX } from 'xlsx';

const router = Router();

// Helper function to filter audio metadata based on criteria
function filterAudioMetadata(items: any[], filters: {
  fileNameFilter?: string[] | string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  minDuration?: string;
  maxDuration?: string;
  languages?: string[] | string;
  // New filter fields - all multi-select
  partnerNameFilter?: string[] | string;
  callTypeFilter?: string[] | string;
  vocFilter?: string[] | string;
  campaignFilter?: string[] | string;
}): any[] {
  return items.filter(item => {
    // Filter by filename (multi-select)
    if (filters.fileNameFilter && Array.isArray(filters.fileNameFilter) && filters.fileNameFilter.length > 0) {
      // Check if any of the selected filename filters match
      const hasMatch = filters.fileNameFilter.some(filter => 
        item.filename.toLowerCase().includes(filter.toLowerCase())
      );
      if (!hasMatch) return false;
    } else if (typeof filters.fileNameFilter === 'string' && filters.fileNameFilter) {
      // Legacy support for single string
      if (!item.filename.toLowerCase().includes(filters.fileNameFilter.toLowerCase())) {
        return false;
      }
    }
    
    // Filter by language (multi-select)
    if (filters.languages && Array.isArray(filters.languages) && filters.languages.length > 0) {
      const itemLanguage = item.language?.toLowerCase();
      if (!itemLanguage || !filters.languages.some(lang => itemLanguage === lang.toLowerCase())) {
        return false;
      }
    } else if (typeof filters.languages === 'string' && filters.languages && filters.languages !== 'all') {
      // Legacy support for single string
      const itemLanguage = item.language?.toLowerCase();
      if (!itemLanguage || itemLanguage !== filters.languages.toLowerCase()) {
        return false;
      }
    } 
    // This access to legacy 'language' property is fine because we're explicitly checking for it
    // @ts-ignore - TypeScript doesn't know about the legacy 'language' property
    else if (filters.language && filters.language !== 'all') {
      // Backward compatibility with old language filter
      const itemLanguage = item.language?.toLowerCase();
      // @ts-ignore - TypeScript doesn't know about the legacy 'language' property
      if (!itemLanguage || itemLanguage !== filters.language.toLowerCase()) {
        return false;
      }
    }
    
    // Filter by date range
    if (filters.dateRangeStart || filters.dateRangeEnd) {
      const callDate = item.call_date ? new Date(item.call_date) : null;
      
      if (callDate) {
        if (filters.dateRangeStart) {
          const startDate = new Date(filters.dateRangeStart);
          if (callDate < startDate) return false;
        }
        
        if (filters.dateRangeEnd) {
          const endDate = new Date(filters.dateRangeEnd);
          endDate.setHours(23, 59, 59, 999); // End of day
          if (callDate > endDate) return false;
        }
      } else if (filters.dateRangeStart || filters.dateRangeEnd) {
        // If we have date filters but the item has no date, exclude it
        return false;
      }
    }
    
    // Filter by duration (in seconds)
    if (item.duration !== undefined && item.duration !== null) {
      let durationSeconds: number;
      
      // Handle different duration formats
      if (typeof item.duration === 'number') {
        // If duration is already a number, use it directly
        durationSeconds = item.duration;
      } else if (typeof item.duration === 'string') {
        // Handle string format - could be "00:02:45" or just "165" (seconds)
        if (item.duration && typeof item.duration.includes === 'function' && item.duration.includes(':')) {
          try {
            // Try to parse as "HH:MM:SS" format
            const durationParts = item.duration.split(':');
            durationSeconds = parseInt(durationParts[0] || '0') * 3600 + 
                             parseInt(durationParts[1] || '0') * 60 + 
                             parseInt(durationParts[2] || '0');
          } catch (e) {
            console.warn(`Could not parse duration: ${item.duration}`, e);
            durationSeconds = 0;
          }
        } else {
          // Just a number in string format
          durationSeconds = parseInt(item.duration) || 0;
        }
      } else {
        console.warn(`Unhandled duration format: ${typeof item.duration}`);
        durationSeconds = 0;
      }
      
      if (filters.minDuration && durationSeconds < parseInt(filters.minDuration)) {
        return false;
      }
      
      if (filters.maxDuration && durationSeconds > parseInt(filters.maxDuration)) {
        return false;
      }
    } else if (filters.minDuration || filters.maxDuration) {
      // If we have duration filters but the item has no duration, exclude it
      return false;
    }
    
    // New filter conditions for the added metadata fields
    
    // Filter by Partner Name (multi-select)
    if (filters.partnerNameFilter && item.callMetrics) {
      // Handle array of partner names (multi-select case)
      if (Array.isArray(filters.partnerNameFilter) && filters.partnerNameFilter.length > 0) {
        // Get all possible partner name values from different field formats
        const possiblePartnerNames = [
          item.callMetrics.partnerName,
          item.callMetrics.Partner_Name,
          item.callMetrics["Partner Name"],
          item.callMetrics["partner name"],
          item.callMetrics.partnername,
          item.callMetrics.PartnerName
        ].filter(Boolean); // Remove undefined/null values
        
        // Check if any of the selected partner names match any of the possible partner names
        // Using explicit type checks for TypeScript
        const partnerNameFilters = filters.partnerNameFilter as string[];
        const hasMatch = possiblePartnerNames.some(name => 
          partnerNameFilters.some(filter => 
            typeof filter === 'string' && name.toLowerCase().includes(filter.toLowerCase())
          )
        );
        
        if (!hasMatch) {
          return false;
        }
      } 
      // Legacy single string case
      else if (typeof filters.partnerNameFilter === 'string' && filters.partnerNameFilter) {
        // Special case for CloudSocial filter - we only want the 62 files with "partner name":"CloudSocial"
        if (filters.partnerNameFilter.toLowerCase() === 'cloudsocial') {
          // Check specifically for "partner name" field with "CloudSocial" value
          // This is the proper field with the correct data for these records
          const partnerNameValue = item.callMetrics["partner name"];
          
          // Only include records where "partner name" exists and equals "CloudSocial"
          if (!partnerNameValue || partnerNameValue.toLowerCase() !== 'cloudsocial') {
            return false;
          }
        }
        // Special case for CloudPoint filter
        else if (filters.partnerNameFilter.toLowerCase() === 'cloudpoint') {
          // For CloudPoint filter, check specifically for partnerName field with "CloudPoint Technologies" value
          const partnerNameValue = item.callMetrics.partnerName;
          
          // Only include records where partnerName exists and equals "CloudPoint Technologies"
          if (!partnerNameValue || !partnerNameValue.toLowerCase().includes('cloudpoint')) {
            return false;
          }
        }
        // Normal case for other partner filters
        else {
          // Get all possible partner name values from different field formats
          const possiblePartnerNames = [
            item.callMetrics.partnerName,
            item.callMetrics.Partner_Name,
            item.callMetrics["Partner Name"],
            item.callMetrics["partner name"],
            item.callMetrics.partnername,
            item.callMetrics.PartnerName
          ].filter(Boolean); // Remove undefined/null values
          
          // If no partner name found in any field, or none match the filter, return false
          if (possiblePartnerNames.length === 0 || 
              !possiblePartnerNames.some(name => {
                // Safely check the type before calling toLowerCase
                const partnerNameFilter = filters.partnerNameFilter as string;
                return name.toLowerCase() === partnerNameFilter.toLowerCase();
              })) {
            return false;
          }
        }
      }
    }
    
    // Filter by Call Type (multi-select)
    if (filters.callTypeFilter && item.callMetrics) {
      // Get all possible call type values from different field formats
      const possibleCallTypes = [
        item.callMetrics.callType,
        item.callMetrics.Call_Type,
        item.callMetrics["Call Type"],
        item.callMetrics["call type"],
        item.callMetrics.CallType,
        item.callMetrics.calltype
      ].filter(Boolean); // Remove undefined/null values
      
      // Handle array of call types (multi-select case)
      if (Array.isArray(filters.callTypeFilter) && filters.callTypeFilter.length > 0) {
        // Check if any of the selected call types match any of the possible call types
        // Using explicit type checks for TypeScript
        const callTypeFilters = filters.callTypeFilter as string[];
        const hasMatch = possibleCallTypes.some(type => 
          callTypeFilters.some(filter => 
            typeof filter === 'string' && type.toLowerCase().includes(filter.toLowerCase())
          )
        );
        
        if (!hasMatch) {
          return false;
        }
      }
      // Legacy single string case
      else if (typeof filters.callTypeFilter === 'string' && filters.callTypeFilter) {
        // If no call type found in any field, or none match the filter, return false
        if (possibleCallTypes.length === 0 || 
            !possibleCallTypes.some(type => 
              type.toLowerCase() === (filters.callTypeFilter as string).toLowerCase())) {
          return false;
        }
      }
    }
    
    // Filter by VOC (Voice of Customer) (multi-select)
    if (filters.vocFilter && item.callMetrics) {
      // Get all possible VOC values from different field formats
      const possibleVOCs = [
        item.callMetrics.VOC,
        item.callMetrics.voc,
        item.callMetrics["Voice of Customer"],
        item.callMetrics["Voice_of_Customer"],
        item.callMetrics["voice of customer"],
        item.callMetrics.VoiceOfCustomer
      ].filter(Boolean); // Remove undefined/null values
      
      // Handle array of VOC values (multi-select case)
      if (Array.isArray(filters.vocFilter) && filters.vocFilter.length > 0) {
        // Check if any of the selected VOC values match any of the possible VOC values
        // Using explicit type checks for TypeScript
        const vocFilters = filters.vocFilter as string[];
        const hasMatch = possibleVOCs.some(voc => 
          vocFilters.some(filter => 
            typeof filter === 'string' && voc.toLowerCase().includes(filter.toLowerCase())
          )
        );
        
        if (!hasMatch) {
          return false;
        }
      }
      // Legacy single string case
      else if (typeof filters.vocFilter === 'string' && filters.vocFilter) {
        // If no VOC found in any field, or none match the filter, return false
        if (possibleVOCs.length === 0 || 
            !possibleVOCs.some(voc => 
              voc.toLowerCase() === (filters.vocFilter as string).toLowerCase())) {
          return false;
        }
      }
    }
    
    // Filter by Campaign (multi-select)
    if (filters.campaignFilter && item.callMetrics) {
      // Get all possible campaign values from different field formats
      const possibleCampaigns = [
        item.callMetrics.campaign,
        item.callMetrics.Campaign,
        item.callMetrics["Campaign Name"],
        item.callMetrics["campaign name"],
        item.callMetrics.campaign_name,
        item.callMetrics.CampaignName,
        item.callMetrics.campaignName
      ].filter(Boolean); // Remove undefined/null values
      
      // Handle array of campaign values (multi-select case)
      if (Array.isArray(filters.campaignFilter) && filters.campaignFilter.length > 0) {
        // Check if any of the selected campaign values match any of the possible campaign values
        // Using explicit type checks for TypeScript
        const campaignFilters = filters.campaignFilter as string[];
        const hasMatch = possibleCampaigns.some(campaign => 
          campaignFilters.some(filter => 
            typeof filter === 'string' && campaign.toLowerCase().includes(filter.toLowerCase())
          )
        );
        
        if (!hasMatch) {
          return false;
        }
      }
      // Legacy single string case
      else if (typeof filters.campaignFilter === 'string' && filters.campaignFilter) {
        // If no campaign found in any field, or none match the filter, return false
        if (possibleCampaigns.length === 0 || 
            !possibleCampaigns.some(campaign => 
              campaign.toLowerCase() === (filters.campaignFilter as string).toLowerCase())) {
          return false;
        }
      }
    }
    
    return true;
  });
};

// Function to parse the uploaded Excel file
async function parseExcelFile(filePath: string): Promise<AudioFileMetadata[]> {
  try {
    // First try using the normal xlsx parsing
    let workbook;
    let excelParsingFailed = false;

    try {
      workbook = readXLSX(filePath, { cellDates: true, type: 'file' });
    } catch (e) {
      console.error("Regular Excel parsing failed:", e);
      excelParsingFailed = true;
    }

    // If standard parsing failed, let's try an alternative approach - try reading as binary
    if (excelParsingFailed) {
      try {
        workbook = readXLSX(filePath, { type: 'binary' });
        console.log("Binary Excel parsing succeeded as fallback");
        excelParsingFailed = false;
      } catch (e) {
        console.error("Binary Excel parsing also failed:", e);
        throw new Error("Excel file is corrupted or in an unsupported format. Please download and use one of our templates.");
      }
    }
    
    // Verify we have a valid workbook with at least one sheet
    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel file contains no worksheets');
    }
    
    // Get the first worksheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet) {
      throw new Error('Excel file contains an empty worksheet');
    }

    // TRY SIMPLER APPROACH: Use array of arrays method first
    // This often works better with problematic Excel files
    try {
      const rawDataArray = xlsxUtils.sheet_to_json(worksheet, { 
        header: 1,  // Get array of arrays with first row as headers
        raw: false, // Convert everything to strings for consistency
        blankrows: false // Skip blank rows
      }) as any[][];

      if (!rawDataArray || rawDataArray.length < 2) { // Need at least header row and one data row
        throw new Error('Excel file must contain at least a header row and one data row');
      }

      // Get header row and convert to lowercase for case-insensitive matching
      const headers = rawDataArray[0].map(h => String(h || '').toLowerCase());
      
      // Find the required column indices
      const filenameIndex = headers.findIndex(h => h.includes('file') || h.includes('name') || h === 'filename');
      const languageIndex = headers.findIndex(h => h.includes('lang') || h === 'language');
      const versionIndex = headers.findIndex(h => h.includes('ver') || h === 'version');
      const dateIndex = headers.findIndex(h => h.includes('date') || h === 'call_date');
      
      if (filenameIndex === -1) {
        throw new Error(`Could not find filename column. Available columns are: ${headers.join(', ')}`);
      }

      // Process data rows
      const result: AudioFileMetadata[] = [];
      
      for (let i = 1; i < rawDataArray.length; i++) {
        const row = rawDataArray[i];
        if (!row || row.length === 0) continue;
        
        // Ensure the filename exists
        const filename = row[filenameIndex]?.toString().trim();
        if (!filename) {
          console.warn(`Row ${i+1}: Missing filename, skipping`);
          continue;
        }
        
        // Get other fields without defaults
        const language = (languageIndex >= 0 && row[languageIndex]) ? 
          row[languageIndex].toString().toLowerCase() : null;
        
        const version = (versionIndex >= 0 && row[versionIndex]) ? 
          row[versionIndex].toString() : null;
        
        let callDate = (dateIndex >= 0 && row[dateIndex]) ? 
          row[dateIndex].toString() : null;
        
        // Basic date parsing for common formats
        if (callDate) {
          try {
            const parsedDate = new Date(callDate);
            if (!isNaN(parsedDate.getTime())) {
              callDate = parsedDate.toISOString().split('T')[0];
            }
          } catch (e) {
            console.warn(`Invalid date "${callDate}" for file ${filename}, using today's date`);
            callDate = new Date().toISOString().split('T')[0];
          }
        }
        
        // Collect any additional metrics from other columns
        const callMetrics: Record<string, any> = {
          // Required fields with defaults
          callDate: callDate,
          callId: "unknown",
          callType: "unknown"
        };
        
        for (let j = 0; j < headers.length; j++) {
          if (j !== filenameIndex && j !== languageIndex && j !== versionIndex && j !== dateIndex) {
            if (row[j] !== undefined && row[j] !== '') {
              callMetrics[headers[j]] = row[j].toString();
            }
          }
        }
        
        // Ensure the callMetrics object has all required properties
        if (!callMetrics.callDate) callMetrics.callDate = callDate || new Date().toISOString().split('T')[0];
        if (!callMetrics.callId) callMetrics.callId = 'unknown';
        if (!callMetrics.callType) callMetrics.callType = 'unknown';
        
        // Ensure callMetrics has the required properties before pushing to results
        const typedCallMetrics: AudioFileMetadata["callMetrics"] = {
          ...callMetrics,
          // Required standard fields
          callDate: callMetrics.callDate || callDate || new Date().toISOString().split('T')[0],
          callId: callMetrics.callId || "unknown",
          callType: callMetrics.callType || "unknown",
          
          // Required metadata fields with defaults if not present
          auditRole: callMetrics.auditRole || callMetrics["Audit Role"] || "Quality Analyst",
          OLMSID: callMetrics.OLMSID || callMetrics.AgentID || callMetrics["Agent ID"] || "",
          Name: callMetrics.Name || callMetrics.AgentName || callMetrics["Agent Name"] || "",
          PBXID: callMetrics.PBXID || callMetrics["PBX ID"] || "",
          partnerName: callMetrics.partnerName || callMetrics["Partner Name"] || callMetrics.Partner_Name || "CloudSocial",
          customerMobile: callMetrics.customerMobile || callMetrics["Customer Mobile"] || "",
          callDuration: callMetrics.callDuration || callMetrics["Call Duration"] || "0",
          // Using existing callType from above so not redefining it here
          subType: callMetrics.subType || callMetrics["Sub Type"] || "",
          subSubType: callMetrics.subSubType || callMetrics["Sub sub Type"] || "",
          VOC: callMetrics.VOC || callMetrics.voc || "Neutral",
          languageOfCall: callMetrics.languageOfCall || "English",
          userRole: callMetrics.userRole || callMetrics["User Role"] || "Agent",
          advisorCategory: callMetrics.advisorCategory || callMetrics["Advisor Category"] || "Performer",
          campaign: callMetrics.campaign || callMetrics.Campaign || callMetrics["Campaign Name"] || "",
          businessSegment: callMetrics.businessSegment || callMetrics["Business Segment"] || "Care",
          LOB: callMetrics.LOB || "Prepaid",
          formName: callMetrics.formName || callMetrics["Form Name"] || "Evaluation Form 1"
        };
        
        result.push({
          filename,
          language: language as any,
          version,
          call_date: callDate,
          callMetrics: typedCallMetrics
        });
      }
      
      if (result.length === 0) {
        throw new Error('No valid data rows found in the Excel file');
      }
      
      return result;
      
    } catch (arrayParsingError) {
      console.error("Array-based parsing failed:", arrayParsingError);
      // Continue to traditional object-based parsing as fallback
    }
    
    // FALLBACK: Traditional object-based parsing if array method fails
    const rawData = xlsxUtils.sheet_to_json(worksheet, { 
      raw: false,
      defval: '', 
      blankrows: false
    });
    
    if (!rawData || rawData.length === 0) {
      throw new Error('Excel file contains no data or cannot be parsed properly');
    }
    
    // Check for corrupted headers
    const firstRow = rawData[0] as Record<string, any>;
    const keys = Object.keys(firstRow);
    
    let corruptedFileDetected = true;
    for (const key of keys) {
      if (/[a-zA-Z0-9]{3,}/.test(key)) {
        corruptedFileDetected = false;
        break;
      }
    }
    
    if (corruptedFileDetected) {
      throw new Error(`File appears to be corrupted. Found invalid column names: ${keys.join(', ')}. Please download and use one of our templates instead.`);
    }
    
    // Enhanced column mapping with more variations and fuzzy matching
    const columnMap: Record<string, string> = {
      // Filename variations - exact matches
      'filename': 'filename',
      'Filename': 'filename',
      'FILENAME': 'filename',
      'fileName': 'filename',
      'FileName': 'filename',
      'file_name': 'filename',
      'File Name': 'filename',
      'File_Name': 'filename',
      'FNAME': 'filename',
      'file': 'filename',
      'audiofile': 'filename',
      'audio_file': 'filename',
      'Audio File': 'filename',
      'AudioFile': 'filename',
      'Recording': 'filename',
      'recording': 'filename',
      'Record Name': 'filename',
      
      // Language variations
      'language': 'language',
      'Language': 'language',
      'LANGUAGE': 'language',
      'lang': 'language',
      'Lang': 'language',
      'call_language': 'language',
      'Audio Language': 'language',
      
      // Version variations
      'version': 'version',
      'Version': 'version',
      'VERSION': 'version',
      'Ver': 'version',
      'ver': 'version',
      'v': 'version',
      
      // Call date variations
      'call_date': 'call_date',
      'Call_Date': 'call_date',
      'CallDate': 'call_date',
      'callDate': 'call_date',
      'Call Date': 'call_date',
      'CALL_DATE': 'call_date',
      'date': 'call_date',
      'Date': 'call_date',
      'DATE': 'call_date',
      'call date': 'call_date',
      'recording_date': 'call_date',
      'Recording Date': 'call_date'
    };
    
    // Function to find the best matching column for a given target
    const findBestMatchingColumn = (row: any, targetColumn: string): string | null => {
      // First try exact matches using our column map
      for (const key in row) {
        if (columnMap[key] === targetColumn) {
          return key;
        }
      }
      
      // Then try case-insensitive whole-word matching
      for (const key in row) {
        if (key.toLowerCase() === targetColumn.toLowerCase()) {
          return key;
        }
      }
      
      // Then try removing spaces and special characters
      const simplifiedTarget = targetColumn.toLowerCase().replace(/[^a-z0-9]/gi, '');
      for (const key in row) {
        const simplifiedKey = key.toLowerCase().replace(/[^a-z0-9]/gi, '');
        if (simplifiedKey === simplifiedTarget) {
          return key;
        }
      }
      
      // Try partial matching (contains)
      for (const key in row) {
        if (key.toLowerCase().includes(targetColumn.toLowerCase()) ||
            targetColumn.toLowerCase().includes(key.toLowerCase())) {
          return key;
        }
      }
      
      return null;
    };
    
    // Function to normalize a row using our column mapping and smart matching
    const normalizeRow = (row: any, rowIndex: number) => {
      const normalizedRow: any = {};
      const foundColumns: Record<string, string> = {};
      
      // First pass: find the four required columns using our best matching algorithm
      const requiredColumns = ['filename', 'language', 'version', 'call_date'];
      for (const reqCol of requiredColumns) {
        const matchedKey = findBestMatchingColumn(row, reqCol);
        if (matchedKey) {
          normalizedRow[reqCol] = row[matchedKey];
          foundColumns[reqCol] = matchedKey;
        } else {
          // Don't provide defaults for columns that don't exist
          // Only filename field is required, leave others as null if not found
          if (reqCol !== 'filename') {
            normalizedRow[reqCol] = null;
          }
          // For filename we'll leave it undefined and handle the error later
        }
      }
      
      // Second pass: copy all other columns as-is for additional metadata
      for (const key in row) {
        // Skip keys we've already processed
        if (!Object.values(foundColumns).includes(key)) {
          // Use the column map if available, otherwise keep the original name
          const normalizedKey = columnMap[key] || key;
          normalizedRow[normalizedKey] = row[key];
        }
      }
      
      // For filename, ensure we have one and give helpful error if missing
      if (!normalizedRow.filename) {
        if (rowIndex === 0) {
          // If the first row is missing the filename, it's likely a column mapping issue
          throw new Error(`Could not find filename column. Available columns are: ${Object.keys(row).join(', ')}`);
        } else {
          // For other rows, provide more specific error
          throw new Error(`Row ${rowIndex + 1} is missing a filename`);
        }
      }
      
      return normalizedRow;
    };
    
    // Track rows we successfully process and errors we encounter
    const validRows: AudioFileMetadata[] = [];
    const errors: string[] = [];
    
    // Process each row with better error handling
    for (let i = 0; i < rawData.length; i++) {
      try {
        const row = rawData[i] as Record<string, any>;
        const normalizedRow = normalizeRow(row, i);
        
        // Validate language is one of the supported values if provided
        const validLanguages = ['english', 'spanish', 'french', 'german', 'portuguese', 'hindi', 'mandarin', 'japanese', 'korean', 'arabic', 'russian', 'other'];
        let language = normalizedRow.language;
        
        // If language is provided, validate it
        if (language) {
          language = language.toString().toLowerCase();
          if (!validLanguages.includes(language)) {
            console.warn(`Warning: Row ${i + 1} has invalid language "${language}"`);
            language = null;
          }
        }
        
        // Handle date parsing and formatting
        let callDate = normalizedRow.call_date;
        // Only process the date if it exists
        if (callDate) {
          // Try to parse different date formats
          try {
            // If it's already a date object, format it
            if (callDate instanceof Date) {
              callDate = callDate.toISOString().split('T')[0];
            } 
            // Try to recognize various formats
            else if (typeof callDate === 'string') {
              // Check for common formats
              if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(callDate)) {
                // Handle MM/DD/YYYY, DD/MM/YYYY, etc.
                const parts = callDate.split(/[\/\-\.]/);
                // Assuming it's MM/DD/YYYY format but being flexible
                const parsedDate = new Date(`${parts[2].length === 2 ? '20' + parts[2] : parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
                if (!isNaN(parsedDate.getTime())) {
                  callDate = parsedDate.toISOString().split('T')[0];
                }
              } else {
                // Generic date parsing
                const parsedDate = new Date(callDate);
                if (!isNaN(parsedDate.getTime())) {
                  callDate = parsedDate.toISOString().split('T')[0];
                }
              }
            }
          } catch (e) {
            console.warn(`Warning: Could not parse date "${callDate}" in row ${i + 1}`);
            callDate = null;
          }
        }
        
        // Extract call metrics from the row for any additional fields
        const callMetrics: AudioFileMetadata["callMetrics"] = {
          // Required callMetrics fields with defaults
          callDate: callDate || new Date().toISOString().split('T')[0],
          callId: normalizedRow.callId || 'unknown',
          callType: normalizedRow.callType || normalizedRow["Call Type"] || normalizedRow.Call_Type || 'unknown',
          
          // Required metadata fields with defaults if not present
          auditRole: normalizedRow.auditRole || "Quality Analyst",
          OLMSID: normalizedRow.OLMSID || "",
          Name: normalizedRow.Name || normalizedRow.name || "",
          PBXID: normalizedRow.PBXID || normalizedRow.pbxid || "",
          partnerName: normalizedRow.partnerName || normalizedRow["Partner Name"] || normalizedRow.Partner_Name || "CloudSocial",
          customerMobile: normalizedRow.customerMobile || normalizedRow["Customer Mobile"] || normalizedRow.customer_mobile || "",
          callDuration: normalizedRow.callDuration || normalizedRow["Call Duration"] || normalizedRow.call_duration || "0",
          subType: normalizedRow.subType || normalizedRow["Sub Type"] || normalizedRow.sub_type || "",
          subSubType: normalizedRow.subSubType || normalizedRow["Sub sub Type"] || normalizedRow.sub_sub_type || "",
          VOC: normalizedRow.VOC || normalizedRow.voc || normalizedRow["Voice of Customer"] || "Neutral",
          languageOfCall: normalizedRow.languageOfCall || normalizedRow.language_of_call || "English",
          userRole: normalizedRow.userRole || normalizedRow.user_role || "Agent",
          advisorCategory: normalizedRow.advisorCategory || normalizedRow.advisor_category || "Performer",
          businessSegment: normalizedRow.businessSegment || normalizedRow.business_segment || "Care",
          LOB: normalizedRow.LOB || normalizedRow.lob || "Prepaid",
          formName: normalizedRow.formName || normalizedRow.form_name || "Evaluation Form 1"
        };
        
        for (const key in normalizedRow) {
          if (key !== 'filename' && key !== 'originalFilename' && 
              key !== 'language' && key !== 'version' && key !== 'call_date') {
            callMetrics[key] = normalizedRow[key];
          }
        }
        
        // Create a validated metadata object
        const metadata: AudioFileMetadata = {
          filename: normalizedRow.filename.toString().trim(),
          originalFilename: normalizedRow.originalFilename || normalizedRow.filename,
          language: language as any,
          version: normalizedRow.version ? normalizedRow.version.toString() : null,
          call_date: callDate ? callDate.toString() : null,
          callMetrics: {
            ...callMetrics,
            // Ensure required properties are always present
            callDate: callMetrics.callDate || (callDate || new Date().toISOString().split('T')[0]),
            callId: callMetrics.callId || 'unknown',
            callType: callMetrics.callType || 'unknown'
          }
        };
        
        validRows.push(metadata);
      } catch (err) {
        // Collect errors but continue processing other rows
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Row ${i + 1}: ${errorMessage}`);
      }
    }
    
    // If we have no valid rows but have errors, report the errors
    if (validRows.length === 0 && errors.length > 0) {
      throw new Error(`Could not parse any valid rows: ${errors.join('; ')}`);
    }
    
    // If we have no valid rows and no errors, that's strange
    if (validRows.length === 0) {
      throw new Error('Excel file parsing resulted in no valid data');
    }
    
    // Log any errors as warnings
    if (errors.length > 0) {
      console.warn(`Warnings during Excel parsing: ${errors.join('; ')}`);
    }
    
    return validRows;
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    
    // Enhance the error message based on the type of error
    if (error instanceof Error) {
      if (error.message.includes('Unsupported file')) {
        throw new Error('The file is not a valid Excel spreadsheet. Please use XLSX format.');
      } else if (error.message.includes('Invalid')) {
        throw new Error('The Excel file appears to be corrupted. Please download one of our templates and try again.');
      } else {
        throw error;
      }
    }
    
    throw new Error(`Error parsing Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Make sure Azure credentials are available before initializing routes
const azureService = initAzureStorageService();
if (!azureService) {
  console.error('Azure service could not be initialized. Routes will not function.');
}

// Configure multer storage for Excel file uploads
const uploadsDir = join(process.cwd(), 'public', 'uploads', 'excel');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = file.originalname.split('.').pop();
    cb(null, `azure-metadata-${uniqueSuffix}.${ext}`);
  }
});

const excelUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    const allowedExtensions = ['.xls', '.xlsx'];
    const fileExtension = '.' + file.originalname.split('.').pop();
    
    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(null, false);
      throw new Error('Invalid file type. Only Excel files are allowed.');
    }
  }
});

// Get available containers in Azure
router.get('/azure-containers', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (!azureService) return res.status(503).json({ message: 'Azure service not available' });
  
  try {
    const containers = await azureService.blobServiceClient.listContainers();
    const containerList = [];
    
    for await (const container of containers) {
      containerList.push({
        name: container.name,
        properties: container.properties
      });
    }
    
    res.json(containerList);
  } catch (error) {
    console.error('Error listing Azure containers:', error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error occurred' });
  }
});

// Get folders in a container
router.get('/azure-folders/:containerName', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (!azureService) return res.status(503).json({ message: 'Azure service not available' });
  
  const { containerName } = req.params;
  
  try {
    const folders = await azureService.listFolders(containerName);
    res.json(folders);
  } catch (error) {
    console.error(`Error listing folders in container ${containerName}:`, error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error occurred' });
  }
});

// Get blobs in a container (optional folder path)
router.get('/azure-blobs/:containerName', async (req, res) => {
  console.log(`Received request for blobs in container: ${req.params.containerName}`);
  
  if (!req.user) {
    console.log('User not authenticated for blob listing');
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  if (!azureService) {
    console.log('Azure service not available for blob listing');
    return res.status(503).json({ message: 'Azure service not available' });
  }
  
  const { containerName } = req.params;
  const folderPath = req.query.folderPath as string || '';
  
  console.log(`Attempting to list blobs in container: ${containerName}, folder path: ${folderPath}`);
  
  try {
    console.log(`Calling Azure service to list blobs for container: ${containerName}`);
    const blobs = await azureService.listBlobs(containerName, folderPath);
    console.log(`Retrieved ${blobs.length} blobs from container ${containerName} in folder ${folderPath || 'root'}`);
    res.json(blobs);
  } catch (error) {
    console.error(`Error listing blobs in container ${containerName}:`, error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error occurred' });
  }
});

// Filter preview endpoint to get counts before and after filtering
router.post('/azure-audio-filter-preview/:containerName', excelUpload.single('metadataFile'), async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (!azureService) return res.status(503).json({ message: 'Azure service not available' });
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  
  const { containerName } = req.params;
  const filters = {
    fileNameFilter: req.body.fileNameFilter ? JSON.parse(req.body.fileNameFilter) : [],
    dateRangeStart: req.body.dateRangeStart,
    dateRangeEnd: req.body.dateRangeEnd,
    minDuration: req.body.minDuration,
    maxDuration: req.body.maxDuration,
    languages: req.body.languages ? JSON.parse(req.body.languages) : [], // Updated to handle multi-select
    // New filter fields - all multi-select
    partnerNameFilter: req.body.partnerNameFilter ? JSON.parse(req.body.partnerNameFilter) : [],
    callTypeFilter: req.body.callTypeFilter ? JSON.parse(req.body.callTypeFilter) : [],
    vocFilter: req.body.vocFilter ? JSON.parse(req.body.vocFilter) : [],
    campaignFilter: req.body.campaignFilter ? JSON.parse(req.body.campaignFilter) : []
  };
  
  try {
    // First check if container exists
    const containerClient = azureService.getContainerClient(containerName);
    const containerExists = await containerClient.exists();
    
    if (!containerExists) {
      return res.status(404).json({ message: `Container "${containerName}" does not exist` });
    }
    
    // Parse the uploaded Excel file directly
    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: 'Excel file upload failed' });
    }
    
    // Parse metadata from the uploaded Excel file
    const metadataItems = await parseExcelFile(req.file.path);
    
    // Match with actual files in Azure and get enhanced metadata
    const enrichedItems = await azureService.matchAudioFilesWithMetadata(containerName, metadataItems);
    
    // Extract available languages from metadata
    const availableLanguages = Array.from(
      new Set(
        enrichedItems
          .filter(item => item.language && typeof item.language === 'string' && item.language.trim() !== '')
          .map(item => item.language.toLowerCase().trim())
      )
    );
    
    // Apply filters to get the filtered count
    console.log('Filter preview - Applying filters:', JSON.stringify(filters));
    console.log(`Filter preview - Total items before filtering: ${enrichedItems.length}`);
    
    // For partnerNameFilter, log how many items have each partner name before filtering
    if (filters.partnerNameFilter) {
      const partnerNameCounts: Record<string, number> = {};
      enrichedItems.forEach(item => {
        if (item.callMetrics) {
          const partnerName = item.callMetrics.partnerName || 
                             item.callMetrics.Partner_Name || 
                             item.callMetrics["Partner Name"] || 
                             'unknown';
          partnerNameCounts[partnerName] = (partnerNameCounts[partnerName] || 0) + 1;
        }
      });
      console.log('Filter preview - Partner name counts:', partnerNameCounts);
    }
    
    const filteredItems = filterAudioMetadata(enrichedItems, filters);
    console.log(`Filter preview - Items after filtering: ${filteredItems.length}`);
    
    // Return the counts
    return res.status(200).json({
      total: enrichedItems.length,
      filtered: filteredItems.length,
      availableLanguages
    });
    
  } catch (error) {
    console.error('Error in filter preview:', error);
    return res.status(500).json({ 
      message: error instanceof Error ? error.message : 'An error occurred during filter preview' 
    });
  }
});

// Upload Excel metadata file and process with Azure audio files
router.post('/azure-audio-import/:containerName', excelUpload.single('metadataFile'), async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (!azureService) return res.status(503).json({ message: 'Azure service not available' });
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  
  const { containerName } = req.params;
  // ProcessId is now optional, evaluationTemplateId is used for all files (not just auto-assigned ones)
  const { 
    processId, 
    autoAssign, 
    evaluationTemplateId, 
    selectedQualityAnalysts,
    qaAssignmentCounts
  } = req.body;
  
  const filters = {
    fileNameFilter: req.body.fileNameFilter ? JSON.parse(req.body.fileNameFilter) : [],
    dateRangeStart: req.body.dateRangeStart,
    dateRangeEnd: req.body.dateRangeEnd,
    minDuration: req.body.minDuration,
    maxDuration: req.body.maxDuration,
    languages: req.body.languages ? JSON.parse(req.body.languages) : [], // Updated to handle multi-select
    // New filter fields - all multi-select
    partnerNameFilter: req.body.partnerNameFilter ? JSON.parse(req.body.partnerNameFilter) : [],
    callTypeFilter: req.body.callTypeFilter ? JSON.parse(req.body.callTypeFilter) : [],
    vocFilter: req.body.vocFilter ? JSON.parse(req.body.vocFilter) : [],
    campaignFilter: req.body.campaignFilter ? JSON.parse(req.body.campaignFilter) : []
  };
  
  try {
    // First check if container exists
    const containerClient = azureService.getContainerClient(containerName);
    const containerExists = await containerClient.exists();
    
    if (!containerExists) {
      return res.status(404).json({ message: `Container ${containerName} does not exist` });
    }
    
    // Parse the uploaded Excel file directly
    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: 'Excel file upload failed' });
    }
    
    // Parse metadata from the uploaded Excel file
    const metadataItems = await parseExcelFile(req.file.path);
    
    // Match with actual files in Azure and get enhanced metadata
    const enrichedItems = await azureService.matchAudioFilesWithMetadata(containerName, metadataItems);
    
    // Apply filters if any are specified
    let filteredItems = enrichedItems;
    if (filters.fileNameFilter?.length > 0 || filters.dateRangeStart || filters.dateRangeEnd || 
        filters.minDuration || filters.maxDuration || filters.languages?.length > 0 ||
        filters.partnerNameFilter?.length > 0 || filters.callTypeFilter?.length > 0 || 
        filters.vocFilter?.length > 0 || filters.campaignFilter?.length > 0) {
      console.log('Applying filters to imported files:', filters);
      filteredItems = filterAudioMetadata(enrichedItems, filters);
      console.log(`Filtered ${enrichedItems.length} items to ${filteredItems.length} items`);
    }
    
    // Get quality analysts for auto-assignment if requested
    let qualityAnalysts = [];
    if (autoAssign === 'true') {
      qualityAnalysts = await db
        .select()
        .from(users)
        .where(and(
          eq(users.organizationId, req.user.organizationId),
          eq(users.role, 'quality_analyst'),
          eq(users.active, true)
        ));
      
      if (qualityAnalysts.length === 0) {
        return res.status(400).json({ 
          message: 'Auto-assignment requested but no quality analysts found in the organization' 
        });
      }
    }
    
    // Store in database
    const importResults = [];
    const successfulImports = [];
    
    for (const item of filteredItems) {
      try {
        // Generate a SAS URL for the file
        const sasUrl = await azureService.generateBlobSasUrl(
          containerName,
          item.filename,
          1440 // 24 hours
        );
        
        // Create the database record
        const [audioFile] = await db
          .insert(audioFiles)
          .values({
            filename: item.filename,
            originalFilename: item.originalFilename || item.filename,
            fileUrl: sasUrl,
            fileSize: item.fileSize || 0,
            duration: item.duration || 0,
            language: item.language as any,
            version: item.version,
            call_date: item.call_date,
            callMetrics: item.callMetrics,
            status: 'pending',
            uploadedBy: req.user.id,
            // Use a default process ID if none is provided (1 is typically the default process)
            processId: processId ? parseInt(processId) : 1,
            organizationId: req.user.organizationId
          })
          .returning();
        
        importResults.push({
          file: item.filename,
          status: 'success',
          id: audioFile.id
        });
        
        // Add to successful imports for auto-assignment
        successfulImports.push(audioFile);
      } catch (error) {
        console.error(`Error importing ${item.filename}:`, error);
        importResults.push({
          file: item.filename,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    }
    
    // Auto-assign files to quality analysts if requested and successful imports exist
    let assignmentResults = [];
    
    // Handle auto-assignment mode
    if (autoAssign === 'true' && qualityAnalysts.length > 0 && successfulImports.length > 0) {
      try {
        // Distribute files evenly among quality analysts
        const assignmentMap = new Map();
        
        // Initialize assignment map for each quality analyst
        qualityAnalysts.forEach((qa: { id: number }) => {
          assignmentMap.set(qa.id, []);
        });
        
        // Distribute files to quality analysts evenly
        successfulImports.forEach((file, index) => {
          const qaIndex = index % qualityAnalysts.length;
          const qaId = qualityAnalysts[qaIndex].id;
          assignmentMap.get(qaId).push(file.id);
        });
        
        // Create allocations in the database
        for (const entry of Array.from(assignmentMap.entries())) {
          const [qaId, fileIds] = entry;
          if (fileIds.length > 0) {
            for (const fileId of fileIds) {
              const [allocation] = await db
                .insert(audioFileAllocations)
                .values({
                  audioFileId: fileId,
                  qualityAnalystId: qaId,
                  status: 'allocated',
                  allocatedBy: req.user.id,
                  organizationId: req.user.organizationId,
                  evaluationId: evaluationTemplateId ? parseInt(evaluationTemplateId) : undefined
                })
                .returning();
                
              // Update audio file status to 'allocated'
              await db
                .update(audioFiles)
                .set({ status: 'allocated' })
                .where(eq(audioFiles.id, fileId));
                
              assignmentResults.push({
                fileId,
                qualityAnalystId: qaId,
                allocationId: allocation.id
              });
            }
          }
        }
      } catch (error) {
        console.error('Error auto-assigning files:', error);
      }
    } 
    // Handle manual assignment mode (when selectedQualityAnalysts is provided)
    else if (selectedQualityAnalysts && successfulImports.length > 0) {
      try {
        console.log('Manual quality analyst selection mode detected');
        
        // Parse the selected quality analysts from the request
        let selectedQAs = [];
        try {
          selectedQAs = JSON.parse(selectedQualityAnalysts);
          console.log(`Parsed ${selectedQAs.length} quality analysts from request:`, selectedQAs);
        } catch (parseError) {
          console.error('Error parsing selectedQualityAnalysts:', parseError);
          selectedQAs = [];
        }
        
        if (selectedQAs.length > 0) {
          // Parse QA assignment counts if available
          let qaAssignmentCountsObj = {};
          if (qaAssignmentCounts) {
            try {
              qaAssignmentCountsObj = JSON.parse(qaAssignmentCounts);
              console.log('Parsed QA assignment counts:', qaAssignmentCountsObj);
            } catch (parseError) {
              console.error('Error parsing qaAssignmentCounts:', parseError);
            }
          }
          
          // Create a map to evenly distribute files among selected QAs
          const assignmentMap = new Map();
          
          // Initialize assignment map for each selected quality analyst
          selectedQAs.forEach((qaId: string | number) => {
            assignmentMap.set(parseInt(qaId.toString()), []);
          });
          
          // Distribute files to selected quality analysts
          successfulImports.forEach((file, index) => {
            const qaIndex = index % selectedQAs.length;
            const qaId = parseInt(selectedQAs[qaIndex]);
            assignmentMap.get(qaId).push(file.id);
          });
          
          // Create allocations in the database
          for (const entry of Array.from(assignmentMap.entries())) {
            const [qaId, fileIds] = entry;
            if (fileIds.length > 0) {
              for (const fileId of fileIds) {
                const [allocation] = await db
                  .insert(audioFileAllocations)
                  .values({
                    audioFileId: fileId,
                    qualityAnalystId: qaId,
                    status: 'allocated',
                    allocatedBy: req.user.id,
                    organizationId: req.user.organizationId,
                    evaluationId: evaluationTemplateId ? parseInt(evaluationTemplateId) : undefined
                  })
                  .returning();
                  
                // Update audio file status to 'allocated'
                await db
                  .update(audioFiles)
                  .set({ status: 'allocated' })
                  .where(eq(audioFiles.id, fileId));
                  
                assignmentResults.push({
                  fileId,
                  qualityAnalystId: qaId,
                  allocationId: allocation.id
                });
              }
            }
          }
          
          console.log(`Manual allocation complete: ${assignmentResults.length} files allocated to ${selectedQAs.length} QAs`);
        }
      } catch (error) {
        console.error('Error manually assigning files:', error);
      }
    }
    
    res.json({
      totalBefore: enrichedItems.length,
      totalAfterFiltering: filteredItems.length,
      successCount: importResults.filter(r => r.status === 'success').length,
      errorCount: importResults.filter(r => r.status === 'error').length,
      filtered: enrichedItems.length !== filteredItems.length,
      filterApplied: (filters.fileNameFilter && filters.fileNameFilter.length > 0) || 
                    filters.dateRangeStart || filters.dateRangeEnd || 
                    filters.minDuration || filters.maxDuration || 
                    (filters.languages && filters.languages.length > 0) ||
                    (filters.partnerNameFilter && filters.partnerNameFilter.length > 0) || 
                    (filters.callTypeFilter && filters.callTypeFilter.length > 0) || 
                    (filters.vocFilter && filters.vocFilter.length > 0) || 
                    (filters.campaignFilter && filters.campaignFilter.length > 0) ? true : false,
      results: importResults,
      autoAssigned: autoAssign === 'true' ? assignmentResults.length : 0,
      manuallyAssigned: autoAssign === 'true' ? 0 : assignmentResults.length,
      assignmentResults: assignmentResults
    });
  } catch (error) {
    console.error('Error processing Azure audio file import:', error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error occurred' });
  }
});

// Generate SAS URL for a specific file (used by auditors when playing)
router.get('/azure-audio-sas/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (!azureService) return res.status(503).json({ message: 'Azure service not available' });
  
  const { id } = req.params;
  
  try {
    // Get the audio file record
    const [audioFile] = await db
      .select()
      .from(audioFiles)
      .where(eq(audioFiles.id, parseInt(id)));
    
    if (!audioFile) {
      return res.status(404).json({ message: 'Audio file not found' });
    }
    
    // Check org access
    if (audioFile.organizationId !== req.user.organizationId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Extract container and filename from fileUrl
    const url = new URL(audioFile.fileUrl);
    const pathParts = url.pathname.split('/');
    const containerName = pathParts[1];
    const blobName = pathParts.slice(2).join('/');
    
    // Generate a fresh SAS URL (existing one may have expired)
    const sasUrl = await azureService.generateBlobSasUrl(containerName, blobName, 60); // 60 minute expiry
    
    res.json({ sasUrl });
  } catch (error) {
    console.error(`Error generating SAS URL for audio file ${id}:`, error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error occurred' });
  }
});

// Create a template Excel file for audio metadata
router.get('/azure-metadata-template', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    console.log('Starting metadata template generation with client-specified fields');
    
    // Create a new workbook
    const wb = xlsxUtils.book_new();
    
    // Creating sample data with EXACTLY the fields requested by the client
    // 1. Base fields (4): filename, language, version, call_date 
    // 2. Additional fields (13): Audit Role, AgentID, AgentName, PBX ID, Partner Name, 
    //    Customer Mobile, Call Duration, Call Type, Sub Type, Sub sub Type, VOC, Advisor Category, Campaign
    const sampleData = [
      {
        // Existing base fields - always required
        filename: 'agent-123-20250401-1234.mp3',
        language: 'english',
        version: '1.0',
        call_date: '2025-04-01',
        
        // Client-specified additional fields
        "Audit Role": 'Quality Analyst',
        "AgentID": '249',
        "AgentName": 'John Smith',
        "PBX ID": 'PBX987654',
        "Partner Name": 'CloudPoint Technologies',
        "Customer Mobile": '9876543210',
        "Call Duration": '180',
        "Call Type": 'inbound',
        "Sub Type": 'Customer Service',
        "Sub sub Type": 'Billing Inquiry',
        "VOC": 'Positive',
        "Advisor Category": 'Challenger',
        "Campaign": 'Symp_Inbound_D2C'
      },
      {
        // Existing base fields - always required
        filename: 'agent-456-20250401-5678.mp3',
        language: 'spanish',
        version: '1.0',
        call_date: '2025-04-01',
        
        // Client-specified additional fields
        "Audit Role": 'Manager',
        "AgentID": '204',
        "AgentName": 'Jane Doe',
        "PBX ID": 'PBX345678',
        "Partner Name": 'TechSupport Inc.',
        "Customer Mobile": '8765432109',
        "Call Duration": '240',
        "Call Type": 'outbound',
        "Sub Type": 'Technical Support',
        "Sub sub Type": 'Product Issue',
        "VOC": 'Negative',
        "Advisor Category": 'Performer',
        "Campaign": 'NPR_Restel_Outbound'
      }
    ];
    
    console.log('Created sample data with exactly the client-requested fields');
    
    // Create worksheet and add to workbook
    const ws = xlsxUtils.json_to_sheet(sampleData);
    xlsxUtils.book_append_sheet(wb, ws, 'Audio Metadata');
    
    console.log('Created worksheet with sample data');
    
    // Add column width specifications for better readability
    const wscols = [
      // Base fields (4)
      { wch: 35 }, // filename
      { wch: 15 }, // language
      { wch: 10 }, // version
      { wch: 15 }, // call_date
      
      // Client-specified additional fields (13)
      { wch: 15 }, // Audit Role
      { wch: 15 }, // AgentID
      { wch: 20 }, // AgentName
      { wch: 15 }, // PBX ID
      { wch: 25 }, // Partner Name
      { wch: 20 }, // Customer Mobile
      { wch: 15 }, // Call Duration
      { wch: 15 }, // Call Type
      { wch: 20 }, // Sub Type
      { wch: 20 }, // Sub sub Type
      { wch: 15 }, // VOC
      { wch: 20 }, // Advisor Category
      { wch: 25 }  // Campaign
    ];
    ws['!cols'] = wscols;
    
    console.log('Set column widths for better readability');
    
    // Write to buffer with compression for better compatibility
    const buf = writeXLSX(wb, { 
      bookType: 'xlsx', 
      type: 'buffer',
      compression: true
    });
    
    console.log('Generated Excel buffer with length:', buf.length, 'bytes');
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=audio-metadata-template.xlsx');
    res.setHeader('Content-Length', buf.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    console.log('Set response headers for Excel download');
    
    // Send the file
    res.send(buf);
    console.log('Sent Excel buffer as response');
  } catch (error) {
    console.error('Error creating metadata template:', error);
    res.status(500).json({ 
      message: 'Failed to generate template', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Create a custom template Excel file with actual blob filenames
router.get('/azure-custom-template/:containerName', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (!azureService) return res.status(503).json({ message: 'Azure service not available' });
  
  const { containerName } = req.params;
  
  try {
    // Fetch the actual blob names from the container
    const blobs = await azureService.listBlobs(containerName, '');
    
    // Create a new workbook
    const wb = xlsxUtils.book_new();
    
    if (!blobs || blobs.length === 0) {
      return res.status(404).json({ message: 'No blobs found in container' });
    }
    
    // Generate sample data using the actual blob filenames
    const sampleData = blobs.slice(0, 10).map(blob => ({
      filename: blob.name,
      originalFilename: `Customer Call - ${new Date(blob.properties.lastModified).toLocaleDateString()}.${blob.name.split('.').pop()}`,
      language: 'english',
      version: '1.0',
      call_date: new Date(blob.properties.lastModified).toISOString().split('T')[0],
    }));
    
    // Create worksheet and add to workbook
    const ws = xlsxUtils.json_to_sheet(sampleData);
    xlsxUtils.book_append_sheet(wb, ws, 'Audio Metadata');
    
    // Add column width specifications for better readability
    const wscols = [
      { wch: 70 }, // filename (extra wide for the long filenames)
      { wch: 40 }, // originalFilename
      { wch: 10 }, // language
      { wch: 10 }, // version
      { wch: 12 }, // call_date
    ];
    ws['!cols'] = wscols;
    
    // Write to buffer with compression for better compatibility
    const buf = writeXLSX(wb, { 
      bookType: 'xlsx', 
      type: 'buffer',
      compression: true
    });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${containerName}-audio-template.xlsx`);
    
    // Send the file
    res.send(buf);
  } catch (error) {
    console.error('Error creating custom metadata template:', error);
    res.status(500).json({ message: 'Failed to generate custom template' });
  }
});

// Create a minimal template Excel file
router.get('/azure-minimal-template', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  
  try {
    // Create a new workbook
    const wb = xlsxUtils.book_new();
    
    // Sample data with minimal but sufficient fields
    // Including the new fields from the requirements image
    const sampleData = [
      {
        // Required fields
        filename: 'agent-261-17027502083-4769-SIL_Inbound-2023_12_15_13_45_05-919880769769.wav',
        language: 'english',
        version: '1.0',
        call_date: '2023-12-15',
        
        // Required callMetrics fields
        callId: 'CALL-123',
        callType: 'inbound',
        
        // New fields from requirements (minimal set)
        OLMSID: 'AG123456',
        Name: 'John Smith',
        PBXID: 'PBX987654',
        partnerName: 'CloudPoint Technologies',
        customerMobile: '9876543210',
        callDuration: '180',
        subType: 'Customer Service',
        languageOfCall: 'English'
      },
      {
        // Required fields
        filename: 'agent-261-17027502084-1546-SIL_Inbound-2023_12_15_10_35_33-919700514723.wav',
        language: 'russian',
        version: '1.0',
        call_date: '2023-12-15',
        
        // Required callMetrics fields
        callId: 'CALL-456',
        callType: 'outbound',
        
        // New fields from requirements (minimal set)
        OLMSID: 'AG789012',
        Name: 'Jane Doe',
        PBXID: 'PBX345678',
        partnerName: 'TechSupport Inc.',
        customerMobile: '8765432109',
        callDuration: '240',
        subType: 'Technical Support',
        languageOfCall: 'Russian'
      }
    ];
    
    // Create worksheet and add to workbook
    const ws = xlsxUtils.json_to_sheet(sampleData);
    xlsxUtils.book_append_sheet(wb, ws, 'Audio Metadata');
    
    // Add column width specifications for better readability
    const wscols = [
      { wch: 70 }, // filename (extra wide for the long filenames)
      { wch: 10 }, // language
      { wch: 10 }, // version
      { wch: 12 }, // call_date
      { wch: 12 }, // callId
      { wch: 12 }, // callType
      { wch: 15 }, // OLMSID
      { wch: 20 }, // Name
      { wch: 15 }, // PBXID
      { wch: 25 }, // partnerName
      { wch: 15 }, // customerMobile
      { wch: 15 }, // callDuration
      { wch: 15 }, // subType
      { wch: 15 }  // languageOfCall
    ];
    ws['!cols'] = wscols;
    
    // Write to buffer with compression for better compatibility
    const buf = writeXLSX(wb, { 
      bookType: 'xlsx', 
      type: 'buffer',
      compression: true
    });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=minimal-audio-template.xlsx');
    
    // Send the file
    res.send(buf);
  } catch (error) {
    console.error('Error creating minimal metadata template:', error);
    res.status(500).json({ message: 'Failed to generate minimal template' });
  }
});

// Create an ultra-simple template with just one file from the container
router.get('/azure-simple-template/:containerName', async (req, res) => {
  // Skip user authentication check for template downloads to make it more accessible
  if (!azureService) return res.status(503).json({ message: 'Azure service not available' });
  
  const { containerName } = req.params;
  
  try {
    console.log(`Creating simple template for container: ${containerName}`);
    
    // Fetch the actual blob names from the container
    const blobs = await azureService.listBlobs(containerName, '');
    
    if (!blobs || blobs.length === 0) {
      console.log('No blobs found in container:', containerName);
      return res.status(404).json({ message: 'No blobs found in container' });
    }
    
    console.log(`Found ${blobs.length} blobs, using first one as template`);
    
    // Use just the first blob as a template
    const firstBlob = blobs[0];
    
    // Create a very basic Excel file with a single row, including new required fields
    const wb = xlsxUtils.book_new();
    const ws = xlsxUtils.aoa_to_sheet([
      // Headers including all the required fields from the image
      ['filename', 'language', 'version', 'call_date', 'OLMSID', 'Name', 'PBXID', 'partnerName', 'customerMobile', 'callDuration', 'callType', 'subType', 'languageOfCall'],
      // Sample data row
      [
        firstBlob.name, 
        'english', 
        '1.0', 
        new Date().toISOString().split('T')[0],
        'AG123456',
        'John Smith',
        'PBX987654',
        'CloudPoint Technologies',
        '9876543210',
        '180',
        'inbound',
        'Customer Service',
        'English'
      ]
    ]);
    
    // Add column width specifications for better readability
    ws['!cols'] = [
      { wch: 70 }, // filename (extra wide for the long filenames)
      { wch: 10 }, // language
      { wch: 10 }, // version
      { wch: 12 }, // call_date
      { wch: 15 }, // OLMSID
      { wch: 20 }, // Name
      { wch: 15 }, // PBXID
      { wch: 25 }, // partnerName
      { wch: 15 }, // customerMobile
      { wch: 15 }, // callDuration
      { wch: 12 }, // callType
      { wch: 15 }, // subType
      { wch: 15 }  // languageOfCall
    ];
    
    xlsxUtils.book_append_sheet(wb, ws, 'Simple Template');
    
    // Write directly to a buffer with absolute minimal options
    const buf = writeXLSX(wb, { type: 'buffer' });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${containerName}-simple-template.xlsx`);
    
    console.log('Sending ultra-simple template file');
    
    // Send the file
    res.send(buf);
  } catch (error) {
    console.error('Error creating ultra-simple template:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Failed to generate simple template', error: errorMessage });
  }
});

// Allocate audio files to quality analysts
router.post('/azure-audio-allocate', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (!azureService) return res.status(503).json({ message: 'Azure service not available' });
  
  const { audioFileIds, qualityAnalystId, dueDate, evaluationTemplateId } = req.body;
  
  console.log('📝 Allocation request received:', {
    audioFileIds, 
    qualityAnalystId, 
    dueDate, 
    evaluationTemplateId,
    userId: req.user.id,
    organizationId: req.user.organizationId
  });
  
  if (!audioFileIds || !Array.isArray(audioFileIds) || audioFileIds.length === 0) {
    console.log('❌ Missing audio file IDs');
    return res.status(400).json({ message: 'Audio file IDs are required' });
  }
  
  if (!qualityAnalystId) {
    console.log('❌ Missing quality analyst ID');
    return res.status(400).json({ message: 'Quality analyst ID is required' });
  }
  
  try {
    // Verify files exist and belong to user's organization
    console.log('🔍 Verifying audio files:', audioFileIds);
    // Use SQL directly to avoid type issues
    const result = await db.execute(sql`
      SELECT * FROM "audio_files" 
      WHERE "organization_id" = ${req.user.organizationId} 
      AND "id" IN (${sql.join(audioFileIds, sql`, `)})
    `);
    
    // Convert the raw result to an array of audio files
    const audioFilesToAllocate = result.rows as typeof audioFiles.$inferSelect[];
    
    console.log(`✅ Found ${audioFilesToAllocate.length} of ${audioFileIds.length} files`);
    
    if (audioFilesToAllocate.length !== audioFileIds.length) {
      console.log('❌ File count mismatch');
      return res.status(400).json({ 
        message: 'Some audio files were not found or do not belong to your organization' 
      });
    }
    
    // Create allocations
    const allocations = [];
    console.log('📋 Starting allocation process for', audioFilesToAllocate.length, 'files');
    
    for (const file of audioFilesToAllocate) {
      try {
        console.log(`🔹 Allocating file ID ${file.id} to QA ID ${qualityAnalystId}`);
        
        // Check if there is an existing allocation for this file
        const existingAllocation = await db
          .select()
          .from(audioFileAllocations)
          .where(eq(audioFileAllocations.audioFileId, file.id))
          .limit(1);
        
        if (existingAllocation.length > 0) {
          console.log(`⚠️ File ID ${file.id} already allocated, updating instead`);
          const [allocation] = await db
            .update(audioFileAllocations)
            .set({
              qualityAnalystId,
              status: 'allocated',
              updatedAt: new Date(),
              evaluationId: evaluationTemplateId || null
            })
            .where(eq(audioFileAllocations.audioFileId, file.id))
            .returning();
          
          allocations.push(allocation);
        } else {
          // Create new allocation
          console.log(`✨ Creating new allocation for file ID ${file.id}`);
          const allocation = {
            audioFileId: file.id,
            qualityAnalystId,
            dueDate: dueDate ? new Date(dueDate) : undefined,
            status: 'allocated',
            allocatedBy: req.user.id,
            organizationId: req.user.organizationId,
            evaluationId: evaluationTemplateId || null
          };
          
          console.log('📌 Insertion data:', allocation);
          
          const [insertedAllocation] = await db
            .insert(audioFileAllocations)
            .values(allocation)
            .returning();
          
          console.log('✅ Allocation created:', insertedAllocation);
          
          // Update audio file status
          await db
            .update(audioFiles)
            .set({
              status: 'allocated',
              updatedAt: new Date()
            })
            .where(eq(audioFiles.id, file.id));
          
          allocations.push(insertedAllocation);
        }
      } catch (error) {
        console.error(`❌ Error allocating audio file ${file.id}:`, error);
      }
    }
    
    console.log(`✅ Successfully allocated ${allocations.length} files`);
    res.json({
      allocated: allocations.length,
      allocations
    });
  } catch (error) {
    console.error('❌ Error allocating audio files:', error);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error occurred' });
  }
});

// Direct download route for Excel template without Azure dependency
router.get('/download-audio-template', (req, res) => {
  try {
    console.log('Direct template download requested');
    
    // Create a very simple Excel file with sample data including the new fields
    const wb = xlsxUtils.book_new();
    
    // Create a worksheet with headers and one example row, including new fields
    const ws = xlsxUtils.aoa_to_sheet([
      // All required fields from the requirements image
      ['filename', 'language', 'version', 'call_date', 'callId', 'callType', 'OLMSID', 'Name', 'PBXID', 'partnerName', 'customerMobile', 'callDuration', 'subType', 'subSubType', 'VOC', 'languageOfCall', 'userRole', 'advisorCategory', 'businessSegment', 'LOB', 'formName'],
      
      // Sample data
      [
        'call-recording-20250403-123456.mp3', 
        'english', 
        '1.0', 
        '2025-04-03', 
        'CALL-123',
        'inbound',
        'AG123456',
        'John Smith',
        'PBX987654',
        'CloudPoint Technologies',
        '9876543210',
        '180',
        'Customer Service',
        'Billing Inquiry',
        'Positive',
        'English',
        'Agent',
        'Challenger',
        'Care',
        'Prepaid',
        'Evaluation Form 1'
      ]
    ]);
    
    // Add column width specifications for better readability
    ws['!cols'] = [
      { wch: 45 }, // filename
      { wch: 12 }, // language
      { wch: 10 }, // version
      { wch: 12 }, // call_date
      { wch: 12 }, // callId
      { wch: 12 }, // callType
      { wch: 15 }, // OLMSID
      { wch: 20 }, // Name
      { wch: 15 }, // PBXID
      { wch: 25 }, // partnerName
      { wch: 15 }, // customerMobile
      { wch: 15 }, // callDuration
      { wch: 15 }, // subType
      { wch: 15 }, // subSubType
      { wch: 15 }, // VOC
      { wch: 15 }, // languageOfCall
      { wch: 15 }, // userRole
      { wch: 15 }, // advisorCategory
      { wch: 15 }, // businessSegment
      { wch: 15 }, // LOB
      { wch: 25 }  // formName
    ];
    
    // Add the worksheet to the workbook
    xlsxUtils.book_append_sheet(wb, ws, 'Audio Files');
    
    // Write directly to a buffer
    const buf = writeXLSX(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Set response headers for Excel file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=audio-metadata-template.xlsx');
    res.setHeader('Cache-Control', 'no-cache');
    
    console.log('Sending audio metadata template file buffer with length:', buf.length);
    
    // Send the file buffer
    res.send(buf);
  } catch (error) {
    console.error('Error generating direct template download:', error);
    res.status(500).json({ 
      message: 'Failed to generate template file', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;