  // Add template download endpoint
  app.get("/api/templates/user-upload", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      // Create workbook with template
      const workbook = XLSX.utils.book_new();
      const templateData = [{
        username: 'john.doe',
        fullName: 'John Doe',
        email: 'john.doe@example.com',
        employeeId: 'EMP001',
        role: 'trainer',
        phoneNumber: '1234567890',
        location: 'Main Office',
        reportingManagerId: 'MGR001', // Added reporting manager field
        processes: 'Process1, Process2'
      }];

      const worksheet = XLSX.utils.json_to_sheet(templateData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');

      // Set headers for file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=user-upload-template.xlsx');

      // Send the workbook
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.send(buffer);
    } catch (error: any) {
      console.error("Template generation error:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });