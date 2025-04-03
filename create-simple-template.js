import * as XLSX from 'xlsx';

// Create the simplest possible Excel file with a header and one data row
try {
  console.log('Creating ultra-simple Excel template...');
  
  // Create a basic workbook
  const wb = XLSX.utils.book_new();
  
  // Create a worksheet with array-of-arrays method (most reliable)
  const data = [
    ['filename', 'language', 'version', 'call_date'],
    ['example-file-123.mp3', 'english', '1.0', '2025-04-03']
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Add column widths
  ws['!cols'] = [
    { wch: 70 }, // filename
    { wch: 10 }, // language
    { wch: 10 }, // version
    { wch: 12 }  // call_date
  ];
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Simple Template');
  
  // Write file to disk
  XLSX.writeFile(wb, 'ultra-simple-template.xlsx');
  
  console.log('Ultra-simple Excel template created successfully: ultra-simple-template.xlsx');
} catch (error) {
  console.error('Error creating simple template:', error);
}