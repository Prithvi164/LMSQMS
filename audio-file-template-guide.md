# Audio File Metadata Template Guide

## Required Columns

Your Excel file MUST include the following columns with exact spelling:

1. **filename** - The exact filename as it appears in Azure storage (e.g., "agent-123-20250401-1234.mp3")
2. **language** - Must be one of: english, spanish, french, hindi, other
3. **version** - Version information (e.g., "1.0")
4. **call_date** - Date in YYYY-MM-DD format (e.g., "2025-04-01")

## Recommended Additional Columns

While only the above columns are strictly required, the following columns provide valuable metadata:

- **originalFilename** - Original name of the file before upload
- **callId** - Unique identifier for the call
- **callType** - Type of call (e.g., "inbound", "outbound")
- **agentId** - ID of the agent who handled the call
- **campaignName** - Name of the campaign associated with the call
- **duration** - Duration of the call in minutes
- **disposition1** - Primary call disposition
- **disposition2** - Secondary call disposition
- **customerMobile** - Customer's mobile number
- **callTime** - Time of call in HH:MM:SS format
- **subType** - Sub-type of the call
- **subSubType** - Further categorization
- **VOC** - Voice of customer classification
- **userRole** - Role of the user
- **advisorCategory** - Category of the advisor
- **queryType** - Type of query
- **businessSegment** - Business segment the call relates to

## Example Data Format

```
filename,language,version,call_date,originalFilename,callId
agent-261-17027502083-47.mp3,english,1.0,2023-12-16,Customer Call - Support Issue.mp3,101
agent-329-17027503458-96.mp3,spanish,1.0,2023-12-16,Customer Call - Billing Question.mp3,102
```

## Important Notes

1. The **filename** column MUST match exactly the filename in your Azure container
2. Ensure there are no extra spaces in column headers
3. Make sure the file is saved as .xlsx format
4. Do not include any formulas or special formatting

## How to Fix Your Current Issue

If you already have an Excel file but it's missing the required "filename" column:

1. Open your Excel file
2. Add a new column with the header "filename"
3. Fill in this column with the exact filenames from your Azure container
4. Save the file and try importing again