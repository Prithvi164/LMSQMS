const { Pool } = require('pg');
const xlsx = require('xlsx');
require('dotenv').config();

async function exportTablesToExcel() {
  // Create a connection to the PostgreSQL database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Connecting to database...');
    
    // Query to get all table names in the database
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    console.log('Fetching table names...');
    const result = await pool.query(tableQuery);
    
    if (result.rows.length === 0) {
      console.log('No tables found in the database.');
      return;
    }
    
    // Extract table names from the result
    const tables = result.rows.map(row => ({
      'Table Name': row.table_name
    }));
    
    console.log(`Found ${tables.length} tables in the database.`);
    
    // Create a new workbook and add the table names
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(tables);
    
    // Add the worksheet to the workbook
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Database Tables');
    
    // Write the workbook to a file
    const filename = 'database-tables.xlsx';
    xlsx.writeFile(workbook, filename);
    
    console.log(`Successfully exported table names to ${filename}`);
  } catch (error) {
    console.error('Error exporting tables to Excel:', error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Execute the function
exportTablesToExcel();