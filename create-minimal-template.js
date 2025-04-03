import * as XLSX from 'xlsx';

// Create a new workbook
const wb = XLSX.utils.book_new();

// Sample data with ONLY the required fields
const sampleData = [
  {
    filename: 'agent-261-17027502083-4769-SIL_Inbound-2023_12_15_13_45_05-919880769769.wav',
    language: 'english',
    version: '1.0',
    call_date: '2023-12-15'
  },
  {
    filename: 'agent-261-17027502084-1546-SIL_Inbound-2023_12_15_10_35_33-919700514723.wav',
    language: 'spanish',
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
  { wch: 10 }, // language
  { wch: 10 }, // version
  { wch: 12 }  // call_date
];
ws['!cols'] = wscols;

// Write to file
XLSX.writeFile(wb, 'minimal-audio-template.xlsx');

console.log('Minimal Excel template created: minimal-audio-template.xlsx');