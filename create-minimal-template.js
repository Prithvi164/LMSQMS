import * as XLSX from 'xlsx';

// Create a new workbook
const wb = XLSX.utils.book_new();

// Sample data with ONLY required fields
const sampleData = [
  {
    filename: 'agent-261-17027502083-47.mp3', // This must match exactly the filename in Azure
    language: 'english', // must be one of: english, spanish, french, hindi, other
    version: '1.0',
    call_date: '2025-04-01' // YYYY-MM-DD format
  },
  {
    filename: 'agent-403-17027502071-7108.mp3',
    language: 'english',
    version: '1.0',
    call_date: '2025-04-01'
  },
  {
    filename: 'agent-403-17027502072-7253.mp3',
    language: 'english',
    version: '1.0',
    call_date: '2025-04-01'
  }
];

// Create worksheet and add to workbook
const ws = XLSX.utils.json_to_sheet(sampleData);
XLSX.utils.book_append_sheet(wb, ws, 'Audio Metadata');

// Add column width specifications for better readability
const wscols = [
  { wch: 30 }, // filename
  { wch: 10 }, // language
  { wch: 10 }, // version
  { wch: 12 }  // call_date
];
ws['!cols'] = wscols;

// Write to file
XLSX.writeFile(wb, 'minimal-audio-template.xlsx');

console.log('Excel template created: minimal-audio-template.xlsx');