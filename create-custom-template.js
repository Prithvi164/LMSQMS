import * as XLSX from 'xlsx';

// Create a new workbook
const wb = XLSX.utils.book_new();

// Sample data with all required fields - using the actual filenames from your Azure container
// Based on the screenshot you shared earlier
const sampleData = [
  {
    filename: 'agent-261-17027502083-4769-SIL_Inbound-2023_12_15_13_45_05-919880769769.wav',
    originalFilename: 'Customer Call - Billing Issue.wav',
    language: 'english',
    version: '1.0',
    call_date: '2023-12-15'
  },
  {
    filename: 'agent-261-17027502084-1546-SIL_Inbound-2023_12_15_10_35_33-919700514723.wav',
    originalFilename: 'Customer Call - Technical Issue.wav',
    language: 'spanish',
    version: '1.0',
    call_date: '2023-12-15'
  },
  {
    filename: 'agent-261-17027502091-7026-SIL_Inbound-2023_12_15_17_00_21-918317567741.wav', 
    originalFilename: 'Customer Call - Product Inquiry.wav',
    language: 'french',
    version: '1.0',
    call_date: '2023-12-15'
  },
  {
    filename: 'agent-261-17027502092-7136-SIL_Inbound-2023_12_15_17_10_21-918369128186.wav',
    originalFilename: 'Customer Call - General Inquiry.wav',
    language: 'german',
    version: '1.0',
    call_date: '2023-12-15'
  },
  {
    filename: 'agent-403-17027502071-7108-SIL_Inbound-2023_12_15_17_46_91-919784897046.wav',
    originalFilename: 'Customer Call - Support Call.wav',
    language: 'english',
    version: '1.0',
    call_date: '2023-12-15'
  }
];

// Create worksheet and add to workbook
const ws = XLSX.utils.json_to_sheet(sampleData);
XLSX.utils.book_append_sheet(wb, ws, 'Audio Metadata');

// Add column width specifications for better readability
const wscols = [
  { wch: 70 }, // filename (extra wide for the long filenames)
  { wch: 40 }, // originalFilename
  { wch: 10 }, // language
  { wch: 10 }, // version
  { wch: 12 }  // call_date
];
ws['!cols'] = wscols;

// Write to file
XLSX.writeFile(wb, 'custom-audio-template.xlsx');

console.log('Custom Excel template created: custom-audio-template.xlsx');