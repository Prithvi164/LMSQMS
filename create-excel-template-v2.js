// New, more reliable template generator using simpler methods
import * as XLSX from 'xlsx';
import { writeFileSync } from 'fs';

console.log('Creating ultra-simple Excel template with basic method...');

try {
  // Create a workbook from scratch
  const wb = XLSX.utils.book_new();

  // Create a worksheet with the simplest possible data (array of arrays)
  const data = [
    ['filename', 'language', 'version', 'call_date'],
    ['agent-261-17027502083-444.mp3', 'english', '1.0', '2025-04-03']
  ];

  // Convert data to worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths for better visibility
  ws['!cols'] = [
    { wch: 50 }, // filename
    { wch: 15 }, // language
    { wch: 10 }, // version
    { wch: 15 }  // call_date
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Template');

  // Generate XLSX file (binary string)
  const binaryString = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
  
  // Convert binary string to buffer
  const buffer = Buffer.from(new Uint8Array(binaryString.length));
  for (let i = 0; i < binaryString.length; i++) {
    buffer[i] = binaryString.charCodeAt(i) & 0xFF;
  }
  
  // Write file to disk
  writeFileSync('ultra-simple-template.xlsx', buffer);
  console.log('Ultra-simple Excel template created successfully: ultra-simple-template.xlsx');
} catch (error) {
  console.error('Error creating template:', error);
}