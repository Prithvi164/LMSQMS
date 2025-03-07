import * as XLSX from 'xlsx';
import { join } from 'path';

// Create workbook
const wb = XLSX.utils.book_new();

// Define headers with role added
const headers = [
  'username',
  'fullName',
  'email',
  'employeeId',
  'phoneNumber',
  'dateOfJoining',
  'dateOfBirth',
  'education',
  'password',
  'role' // Added role column
];

// Create example data row with role
const exampleData = [
  'john.doe',
  'John Doe',
  'john.doe@example.com',
  'EMP123',
  '+1234567890',
  '2025-03-06', // Format: YYYY-MM-DD
  '1990-01-01', // Format: YYYY-MM-DD
  'Bachelor\'s Degree',
  'Password123!', // Will be hashed on upload
  'advisor' // Default role
];

// Create worksheet
const ws = XLSX.utils.aoa_to_sheet([headers, exampleData]);

// Add column widths for better readability
const colWidths = headers.map(() => ({ wch: 15 }));
ws['!cols'] = colWidths;

// Add the worksheet to workbook
XLSX.utils.book_append_sheet(wb, ws, 'Trainees');

// Write to file
const templatePath = join(process.cwd(), 'public', 'templates', 'trainee-upload-template.xlsx');
XLSX.writeFile(wb, templatePath);

console.log('Template created successfully at:', templatePath);