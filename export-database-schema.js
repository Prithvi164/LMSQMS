const { Pool } = require('pg');
const xlsx = require('xlsx');
require('dotenv').config();

async function exportDatabaseSchemaToExcel() {
  // Create a connection to the PostgreSQL database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Connecting to database...');
    
    // Query to get all tables in the database
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    console.log('Fetching table names...');
    const tableResult = await pool.query(tableQuery);
    
    if (tableResult.rows.length === 0) {
      console.log('No tables found in the database.');
      return;
    }
    
    const tables = tableResult.rows.map(row => row.table_name);
    console.log(`Found ${tables.length} tables in the database.`);
    
    // Create a new workbook
    const workbook = xlsx.utils.book_new();
    
    // First sheet - List of all tables
    const tablesSheet = xlsx.utils.json_to_sheet(
      tables.map(table => ({ 'Table Name': table }))
    );
    xlsx.utils.book_append_sheet(workbook, tablesSheet, 'All Tables');

    // Second sheet - Detailed schema information
    const schemaData = [];
    
    // Query to get column information for each table
    for (const table of tables) {
      console.log(`Fetching schema for table: ${table}`);
      
      const columnQuery = `
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          column_default,
          is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `;
      
      const columnResult = await pool.query(columnQuery, [table]);
      
      // Add each column to the schema data
      columnResult.rows.forEach(column => {
        schemaData.push({
          'Table Name': table,
          'Column Name': column.column_name,
          'Data Type': column.data_type + 
            (column.character_maximum_length ? `(${column.character_maximum_length})` : ''),
          'Default Value': column.column_default || '',
          'Nullable': column.is_nullable === 'YES' ? 'Yes' : 'No'
        });
      });
    }
    
    // Create the detailed schema sheet
    const schemaSheet = xlsx.utils.json_to_sheet(schemaData);
    xlsx.utils.book_append_sheet(workbook, schemaSheet, 'Detailed Schema');
    
    // Third sheet - Table relationships (primary and foreign keys)
    const relationshipQuery = `
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM
        information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE
        tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `;
    
    console.log('Fetching table relationships...');
    const relationshipResult = await pool.query(relationshipQuery);
    
    const relationshipData = relationshipResult.rows.map(row => ({
      'Table Name': row.table_name,
      'Column Name': row.column_name,
      'References Table': row.foreign_table_name,
      'References Column': row.foreign_column_name
    }));
    
    const relationshipSheet = xlsx.utils.json_to_sheet(relationshipData);
    xlsx.utils.book_append_sheet(workbook, relationshipSheet, 'Relationships');
    
    // Write the workbook to a file
    const filename = 'database-schema.xlsx';
    xlsx.writeFile(workbook, filename);
    
    console.log(`Successfully exported database schema to ${filename}`);
  } catch (error) {
    console.error('Error exporting database schema to Excel:', error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Execute the function
exportDatabaseSchemaToExcel();