import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file's directory name using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define headers for clarity
const headers = [
  'filename',
  'language',
  'version',
  'call_date',
  'call_type',
  'agent_id',
  'call_id',
  'customer_satisfaction',
  'handle_time'
];

// Sample data for the template
const exampleData = [
  [
    'example_audio_file.mp3',
    'english',
    '1.0',
    '2025-03-31',
    'inbound',
    'AG123',
    'CALL789',
    '4',
    '180'
  ],
  [
    'second_example.mp3',
    'spanish',
    '2.0',
    '2025-03-30',
    'outbound',
    'AG456',
    'CALL456',
    '5',
    '240'
  ]
];

// Create a new workbook
const workbook = XLSX.utils.book_new();

// Create the main worksheet
const mainWorksheet = XLSX.utils.aoa_to_sheet([headers, ...exampleData]);

// Set column widths for better readability
mainWorksheet['!cols'] = headers.map(header => {
  // Set wider columns for filename
  if (header === 'filename') return { wch: 25 };
  // Other columns standard width
  return { wch: 18 };
});

// Add styling to headers (make them bold)
for (let i = 0; i < headers.length; i++) {
  const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
  if (!mainWorksheet[cellRef]) mainWorksheet[cellRef] = { t: 's', v: headers[i] };
  mainWorksheet[cellRef].s = { font: { bold: true } };
}

// Add the main worksheet to the workbook
XLSX.utils.book_append_sheet(workbook, mainWorksheet, 'Audio Files Metadata');

// Create a guidance sheet with instructions
const guidanceData = [
  ['Audio File Metadata - Instructions'],
  [''],
  ['This template is used to provide metadata for audio files in batch uploads.'],
  [''],
  ['Field Instructions:'],
  ['filename', 'Must match the exact filename of the uploaded audio file (including extension)'],
  ['language', 'Use one of: english, spanish, french, hindi, other'],
  ['version', 'Version number or identifier of the call script/process used'],
  ['call_date', 'Date of the call in YYYY-MM-DD format'],
  ['call_type', 'Type of call, e.g., inbound, outbound, service, sales, etc.'],
  ['agent_id', 'ID of the agent who handled the call'],
  ['call_id', 'Unique identifier of the call (if available)'],
  ['customer_satisfaction', 'Customer satisfaction score, typically 1-5'],
  ['handle_time', 'Call duration in seconds']
];

// Create the guidance worksheet
const guidanceWorksheet = XLSX.utils.aoa_to_sheet(guidanceData);

// Set column width for guidance sheet
guidanceWorksheet['!cols'] = [{ wch: 25 }, { wch: 70 }];

// Format the title as bold
const titleCell = XLSX.utils.encode_cell({ r: 0, c: 0 });
if (guidanceWorksheet[titleCell]) {
  guidanceWorksheet[titleCell].s = { font: { bold: true, sz: 14 } };
}

// Format the field names as bold
for (let i = 5; i < 5 + headers.length; i++) {
  const fieldNameCell = XLSX.utils.encode_cell({ r: i, c: 0 });
  if (guidanceWorksheet[fieldNameCell]) {
    guidanceWorksheet[fieldNameCell].s = { font: { bold: true } };
  }
}

// Add the guidance worksheet to the workbook
XLSX.utils.book_append_sheet(workbook, guidanceWorksheet, 'Instructions');

// Create the output directory if it doesn't exist
const outputDir = path.join(__dirname, '../public/templates');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write the workbook to file (XLSX format)
const xlsxOutputPath = path.join(outputDir, 'audio_files_metadata_template.xlsx');
XLSX.writeFile(workbook, xlsxOutputPath);
console.log(`Excel template created at: ${xlsxOutputPath}`);

// For CSV, we only include the main sheet without formatting
// Create a separate workbook for CSV to ensure we only export the main data
const csvWorkbook = XLSX.utils.book_new();
const csvWorksheet = XLSX.utils.aoa_to_sheet([headers, ...exampleData]);
XLSX.utils.book_append_sheet(csvWorkbook, csvWorksheet, 'Audio Files Metadata');

const csvOutputPath = path.join(outputDir, 'audio_files_metadata_template.csv');
XLSX.writeFile(csvWorkbook, csvOutputPath, { bookType: 'csv' });
console.log(`CSV template created at: ${csvOutputPath}`);