import { Router } from 'express';
import { utils, writeFile } from 'xlsx';
import { db } from '../db';
import { organizations, users, processes } from '@shared/schema';
import { eq } from 'drizzle-orm';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Template download endpoint
router.get('/template', async (req, res) => {
  try {
    // Get organization's processes for the template
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const orgProcesses = await db.query.processes.findMany({
      where: eq(processes.organizationId, organizationId),
      columns: {
        id: true,
        name: true,
        lineOfBusinessId: true
      }
    });

    // Create users sheet
    const usersData = [
      ['Username*', 'Full Name*', 'Email*', 'Password*', 'Employee ID*', 'Role*', 'Phone Number*', 'Education', 'Date of Joining*', 'Date of Birth*', 'Category*', 'Location Name'],
      ['john_doe', 'John Doe', 'john@example.com', 'password123', 'EMP001', 'trainee', '+1234567890', 'Bachelor\'s', '2024-03-01', '1990-01-01', 'active', 'HQ'],
      ['Example format - Required fields marked with *']
    ];

    // Create process mappings sheet
    const processMappingsData = [
      ['User Email*', 'Process Name*'],
      ['john@example.com', 'Customer Support'],
      ['john@example.com', 'Sales Support'],
      ['Example format - Add multiple rows for the same email to assign multiple processes']
    ];

    // Create workbook
    const workbook = utils.book_new();

    // Add Users sheet
    const usersSheet = utils.aoa_to_sheet(usersData);
    utils.book_append_sheet(workbook, usersSheet, 'Users');

    // Add Process Mappings sheet
    const processMappingsSheet = utils.aoa_to_sheet(processMappingsData);
    utils.book_append_sheet(workbook, processMappingsSheet, 'Process Mappings');

    // Set column widths
    usersSheet['!cols'] = [
      { wch: 15 }, // Username
      { wch: 20 }, // Full Name
      { wch: 25 }, // Email
      { wch: 15 }, // Password
      { wch: 15 }, // Employee ID
      { wch: 10 }, // Role
      { wch: 15 }, // Phone Number
      { wch: 20 }, // Education
      { wch: 15 }, // Date of Joining
      { wch: 15 }, // Date of Birth
      { wch: 10 }, // Category
      { wch: 20 }, // Location Name
    ];

    processMappingsSheet['!cols'] = [
      { wch: 25 }, // User Email
      { wch: 25 }, // Process Name
    ];

    // Convert workbook to buffer
    const excelBuffer = utils.write(workbook, { 
      type: 'buffer',
      bookType: 'xlsx',
      bookSST: false,
      compression: true
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="user_upload_template.xlsx"');
    res.setHeader('Content-Length', excelBuffer.length);

    // Send the file
    res.send(excelBuffer);
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({ message: 'Failed to generate template' });
  }
});

// Bulk upload endpoint
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Read both sheets from the Excel file
    const workbook = utils.read(req.file.buffer);
    const usersSheet = workbook.Sheets['Users'];
    const processMappingsSheet = workbook.Sheets['Process Mappings'];

    if (!usersSheet || !processMappingsSheet) {
      return res.status(400).json({ 
        message: 'Invalid template format. Please use the provided template with both Users and Process Mappings sheets.' 
      });
    }

    // Parse sheets to JSON
    const users = utils.sheet_to_json(usersSheet);
    const processMappings = utils.sheet_to_json(processMappingsSheet);

    // Validate users data
    for (const user of users) {
      if (!user.Username || !user.Email || !user.Password || !user['Full Name'] || 
          !user['Employee ID'] || !user.Role || !user['Phone Number'] || 
          !user['Date of Joining'] || !user['Date of Birth'] || !user.Category) {
        return res.status(400).json({ 
          message: `Invalid user data. All required fields must be filled for user ${user.Email || 'unknown'}` 
        });
      }
    }

    // Get organization's processes for validation
    const orgProcesses = await db.query.processes.findMany({
      where: eq(processes.organizationId, organizationId),
      columns: {
        id: true,
        name: true
      }
    });

    const processNameToId = new Map(orgProcesses.map(p => [p.name.toLowerCase(), p.id]));

    // Create users and store their process mappings
    const userEmailToProcessIds = new Map();

    // Build process mappings map
    for (const mapping of processMappings) {
      const email = mapping['User Email'];
      const processName = mapping['Process Name'];

      if (!email || !processName) {
        return res.status(400).json({ 
          message: 'Invalid process mapping data. Both User Email and Process Name are required.' 
        });
      }

      const processId = processNameToId.get(processName.toLowerCase());
      if (!processId) {
        return res.status(400).json({ 
          message: `Process "${processName}" not found in your organization.` 
        });
      }

      if (!userEmailToProcessIds.has(email)) {
        userEmailToProcessIds.set(email, new Set());
      }
      userEmailToProcessIds.get(email).add(processId);
    }

    // Create users with their process mappings
    for (const userData of users) {
      const email = userData.Email;
      const processIds = Array.from(userEmailToProcessIds.get(email) || []);

      // Create user
      await db.insert(users).values({
        username: userData.Username,
        fullName: userData['Full Name'],
        email: userData.Email,
        password: userData.Password, // Note: Should be hashed in production
        employeeId: userData['Employee ID'],
        role: userData.Role,
        phoneNumber: userData['Phone Number'],
        education: userData.Education || null,
        dateOfJoining: new Date(userData['Date of Joining']),
        dateOfBirth: new Date(userData['Date of Birth']),
        category: userData.Category,
        organizationId,
        active: true,
        certified: false,
        processes: processIds
      });
    }

    res.json({ message: 'Users uploaded successfully' });
  } catch (error) {
    console.error('Error uploading users:', error);
    res.status(500).json({ message: 'Failed to upload users' });
  }
});

export default router;