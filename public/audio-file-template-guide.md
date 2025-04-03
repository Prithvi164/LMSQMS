# Audio File Metadata Template Guide

## Required Fields

Every Excel template for audio file imports must include the following required columns:

1. **filename** - The exact name of the file as it appears in Azure storage. This must match exactly (case-sensitive) with the filename in the Azure container.
2. **language** - The language of the audio recording. Supported values: `english`, `spanish`, `french`, `hindi`, `other`
3. **version** - Version identifier for the audio file (e.g., "1.0")
4. **call_date** - The date of the call in YYYY-MM-DD format (e.g., "2023-12-15")

## Optional Fields

You can include any additional columns that will be stored as metadata with the audio file. Common optional fields include:

- **originalFilename** - A human-readable name for the file (if not provided, the filename will be used)
- **callId** - Unique identifier for the call in your tracking system
- **callType** - Type of call (e.g., inbound, outbound)
- **agentId** - The ID of the agent who handled the call
- **campaignName** - The associated campaign
- **duration** - Call duration in minutes (this will be automatically detected from the audio file if not provided)
- **disposition1/disposition2** - Call outcome categorizations
- **callTime** - Time of the call (HH:MM:SS)
- **subType/subSubType** - Additional call categorizations
- **VOC** - Voice of Customer sentiment
- **userRole** - The role of the person who handled the call
- **advisorCategory** - The level or category of the advisor
- **queryType** - Type of customer query
- **businessSegment** - Business segment associated with the call

## Troubleshooting

If your import fails, check for these common issues:

1. **Column Names**: Make sure the required columns (`filename`, `language`, `version`, `call_date`) are present and spelled correctly.
2. **File Format**: Use only .xlsx format (Excel 2007+). Avoid CSV files or older Excel formats.
3. **Filename Matching**: The `filename` values must exactly match (including case) the files in your Azure container.
4. **Language Values**: The `language` field must use one of the supported values (all lowercase): english, spanish, french, hindi, other.
5. **Date Format**: The `call_date` should be in YYYY-MM-DD format.

## Template Files

We've provided two template files you can download and use:

1. **custom-audio-template.xlsx** - A template with all fields populated with sample data matching your actual Azure files
2. **minimal-audio-template.xlsx** - A minimal template with only the required fields

These templates are pre-filled with examples using your actual filenames from the Azure container.

## Process

1. Download one of the template files
2. Fill in the data for your audio files (or modify the existing sample data)
3. Save the file as .xlsx
4. Upload the file using the "Import Metadata" button in the Audio File Management page

The system will match the metadata with the corresponding audio files in Azure storage and create database entries for each file.