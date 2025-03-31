import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file's directory name using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sample data for the template
const data = [
  {
    filename: 'example_audio_file.mp3',
    language: 'english',
    version: '1.0',
    call_date: '2025-03-31',
    call_type: 'inbound',
    agent_id: 'AG123',
    call_id: 'CALL789',
    customer_satisfaction: 4,
    handle_time: 180
  },
  {
    filename: 'second_example.mp3',
    language: 'spanish',
    version: '2.0',
    call_date: '2025-03-30',
    call_type: 'outbound',
    agent_id: 'AG456',
    call_id: 'CALL456',
    customer_satisfaction: 5,
    handle_time: 240
  }
];

// Create a new workbook
const workbook = XLSX.utils.book_new();

// Convert data to worksheet
const worksheet = XLSX.utils.json_to_sheet(data);

// Add the worksheet to the workbook
XLSX.utils.book_append_sheet(workbook, worksheet, 'Audio Files Metadata');

// Create the output directory if it doesn't exist
const outputDir = path.join(__dirname, '../public/templates');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write the workbook to file (XLSX format)
const xlsxOutputPath = path.join(outputDir, 'audio_files_metadata_template.xlsx');
XLSX.writeFile(workbook, xlsxOutputPath);
console.log(`Excel template created at: ${xlsxOutputPath}`);

// Write the CSV format
const csvOutputPath = path.join(outputDir, 'audio_files_metadata_template.csv');
XLSX.writeFile(workbook, csvOutputPath, { bookType: 'csv' });
console.log(`CSV template created at: ${csvOutputPath}`);