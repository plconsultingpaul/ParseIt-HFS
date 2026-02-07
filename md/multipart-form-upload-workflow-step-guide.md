# Multipart Form Upload Workflow Step - Implementation Guide

## Overview

The Multipart Form Upload step allows workflows to send files (PDFs) along with text/JSON metadata to external APIs using the `multipart/form-data` content type. This is required when an API expects file uploads via form submission rather than JSON body payloads.

The application already has Token Authentication configured and working. This guide assumes that prerequisite is in place.

---

## Prerequisites

1. **Token Authentication** must be set up in Settings > API Auth Configs with:
   - A login endpoint URL
   - Username and password credentials
   - The token field name from the login response (e.g., `access_token`)

2. **A workflow** must already exist (either a Transform or JSON workflow) where you want to add the multipart step.

3. **The target API endpoint** must accept `multipart/form-data` POST requests.

---

## Database Schema

The `multipart_form_upload` step type is registered in the following constraint tables:

- `workflow_steps` (step_type constraint)
- `workflow_step_logs` (step_type constraint)
- `execute_button_steps` (step_type constraint)
- `execute_button_flow_nodes` (step_type constraint)

The step configuration is stored as JSON in the `config_json` column of the `workflow_steps` table.

---

## Step-by-Step Configuration

### Step 1: Add a New Workflow Step

1. Navigate to **Settings > Workflows**
2. Select or create your workflow
3. Click **Add Step**
4. Set the **Step Type** to `Multipart Form Upload`

### Step 2: Configure the API Source

The API Source determines where the base URL and authentication credentials come from.

| Option | Description |
|--------|-------------|
| **Main API** | Uses the base URL and credentials from your primary API settings (Settings > API) |
| **Secondary API** | Uses a secondary API configuration. You must select which secondary API to use from the dropdown. |
| **Auth Config Only** | Does not use a base URL from API settings. You provide the full URL manually. Authentication token is obtained from the selected Auth Config. |

**When using Main API or Secondary API with Token Authentication override:**
- If you also select an Auth Config, the token from that auth config will **override** the default credentials from the main/secondary API.
- This is useful when the upload endpoint requires a different authentication than the base API.

**When using Auth Config Only:**
- You must provide the **full URL** (not just a path).
- The auth config handles the login and token retrieval automatically.

### Step 3: Select the Authentication Config

1. From the **Authentication Config** dropdown, select your pre-configured auth config.
2. The system will automatically:
   - Call the login endpoint with the stored username/password
   - Extract the token from the response using the configured token field name
   - Include the token as a `Bearer` header on the multipart upload request

### Step 4: Configure the URL / API Path

Enter either:
- A **full URL** (e.g., `https://api.example.com/documents/upload`) when using "Auth Config Only"
- A **relative path** (e.g., `/api/v1/Documents`) when using "Main API" or "Secondary API" -- the path will be appended to the base URL

**Dynamic URL Variables:**
You can use `{{variableName}}` placeholders in the URL that will be replaced with values from the workflow context data at runtime.

Examples:
- `/api/Documents/{{orders[0].documentId}}/upload`
- `/api/v1/shipments/{{extractedData.shipmentId}}/attachments`

Variable values are automatically URL-encoded when substituted.

### Step 5: Configure the Filename Template (Optional)

The filename template controls the name of the uploaded file. If left empty, the original PDF filename is used.

**Format:** Use `{{variableName}}` placeholders to build dynamic filenames.

Examples:
- `{{orders[0].detailLineId}}_document.pdf`
- `{{extractedData.referenceNumber}}_BOL.pdf`
- `INV_{{extractedData.invoiceNumber}}.pdf`

The `.pdf` extension is automatically appended if not present.

### Step 6: Configure Form Parts

Form parts define the individual fields sent in the multipart request. Each part has a **name** and a **type**.

#### Part Types

| Type | Description |
|------|-------------|
| **Text** | Sends a text or JSON string as a form field |
| **File** | Sends the PDF file from the workflow context |

#### Adding a File Part

1. Click **Add Form Part**
2. Set the **Name** to the field name the API expects (e.g., `file`, `document`, `attachment`)
3. Set the **Type** to `File`
4. The PDF data from the workflow context is automatically attached

#### Adding a Text Part

1. Click **Add Form Part**
2. Set the **Name** to the field name the API expects (e.g., `metadata`, `properties`, `data`)
3. Set the **Type** to `Text`
4. Enter the **Value** -- this can be plain text or a JSON template
5. Optionally set the **Content-Type** (e.g., `application/json` for JSON payloads)

#### Example: A Typical Two-Part Upload

**Part 1 - Metadata (Text):**
- Name: `properties`
- Type: `Text`
- Content-Type: `application/json`
- Value:
```json
{
  "name": "",
  "description": "",
  "category": "Transportation",
  "documentType": "BOL"
}
```

**Part 2 - Document (File):**
- Name: `file`
- Type: `File`

### Step 7: Configure Field Mappings for Text Parts

Field mappings allow you to dynamically populate values within your JSON text parts. This is the most powerful feature of the multipart step.

#### Auto-Generate Field Mappings

1. Enter your JSON template in the text part's **Value** field
2. Click the **Map JSON** button
3. The system automatically parses the JSON structure and creates field mappings for every property
4. Existing mappings are preserved -- only new fields are added

#### Field Mapping Properties

| Property | Description |
|----------|-------------|
| **Field Name** | The JSON path to the property (e.g., `name`, `properties.value`, `items.0.id`) |
| **Type** | `Hardcoded` for static values, `Variable` for dynamic values from context |
| **Value** | The literal value (hardcoded) or variable reference (e.g., `{{extractedData.shipperName}}`) |
| **Data Type** | `string`, `integer`, `number`, or `boolean` -- controls how the value is serialized in JSON |

#### How Field Mapping Resolution Works

1. **For valid JSON templates:** The system parses the JSON, finds the property by field name path, and replaces it with the resolved value. This preserves JSON structure and data types.

2. **For non-JSON templates:** The system uses `{{fieldName}}` placeholder replacement in the raw text.

3. **Nested paths** are supported using dot notation:
   - `properties.name` updates `{ "properties": { "name": "..." } }`
   - `items.0.value` updates `{ "items": [{ "value": "..." }] }`

#### Field Mapping Examples

| Field Name | Type | Value | Data Type | Result |
|------------|------|-------|-----------|--------|
| `name` | Hardcoded | `ShipmentDoc` | string | `"name": "ShipmentDoc"` |
| `description` | Variable | `{{extractedData.description}}` | string | `"description": "BOL for Order 12345"` |
| `quantity` | Variable | `{{orders[0].quantity}}` | integer | `"quantity": 5` |
| `isActive` | Hardcoded | `true` | boolean | `"isActive": true` |

#### Using the Variable Dropdown

For Variable-type mappings, click the variable insertion button to browse available context variables. Selected variables are inserted in `{{variableName}}` format and appended to any existing value.

### Step 8: Configure Response Data Mappings (Optional)

Response data mappings extract values from the API response and store them in the workflow context for use by subsequent steps.

| Field | Description |
|-------|-------------|
| **Response Path** | JSON path in the API response (e.g., `data.id`, `result.documentId`) |
| **Context Path** | Where to store the value in the workflow context (e.g., `documentId`, `uploadResult.id`) |

**Example:**
If the upload API returns:
```json
{
  "data": {
    "id": "DOC-12345",
    "status": "uploaded"
  }
}
```

You could map:
- Response Path: `data.id` -> Context Path: `documentId`
- Response Path: `data.status` -> Context Path: `uploadStatus`

These values are then available in later workflow steps as `{{documentId}}` and `{{uploadStatus}}`.

---

## Configuration JSON Structure

The complete configuration stored in `config_json` for a multipart_form_upload step:

```json
{
  "url": "/api/v1/Documents",
  "apiSourceType": "auth_config",
  "authConfigId": "uuid-of-auth-config",
  "secondaryApiId": "uuid-of-secondary-api",
  "filenameTemplate": "{{extractedData.referenceNumber}}_document.pdf",
  "formParts": [
    {
      "name": "properties",
      "type": "text",
      "value": "{\"name\":\"\",\"description\":\"\",\"category\":\"Transportation\"}",
      "contentType": "application/json",
      "fieldMappings": [
        {
          "fieldName": "name",
          "type": "variable",
          "value": "{{extractedData.shipperName}}",
          "dataType": "string"
        },
        {
          "fieldName": "description",
          "type": "hardcoded",
          "value": "Uploaded via automation",
          "dataType": "string"
        },
        {
          "fieldName": "category",
          "type": "hardcoded",
          "value": "Transportation",
          "dataType": "string"
        }
      ]
    },
    {
      "name": "file",
      "type": "file"
    }
  ],
  "responseDataMappings": [
    {
      "responsePath": "data.id",
      "updatePath": "documentId"
    }
  ]
}
```

---

## Authentication Flow

When the step executes, authentication happens in this order:

1. **Determine API source** (main, secondary, or auth_config)
2. **Load base URL and default credentials** from the selected source
3. **If an Auth Config is selected:**
   - POST to the auth config's login endpoint with username/password
   - Extract the token from the response using the configured token field name
   - Use this token for the upload request (overrides any default credentials)
4. **Build the Authorization header** as `Bearer {token}`

**Auth Type Options:**
- `bearer` (default): Sends `Authorization: Bearer {token}`
- `basic`: Sends `Authorization: Basic {token}`

---

## Runtime Execution Flow

1. Load API configuration and authenticate
2. Resolve URL placeholders with context data values
3. Process each form part:
   - **File parts:** Attach PDF binary data from context
   - **Text parts:** Apply field mappings to resolve dynamic values in JSON templates
4. Build the multipart/form-data request body with proper boundaries
5. Send the POST request with appropriate headers
6. Parse the response
7. Apply response data mappings to store results in context
8. Return execution results (request details + response data)

---

## Complete Working Example

### Scenario: Upload a BOL PDF to a Document Management System

**Auth Config (already configured):**
- Login Endpoint: `https://dms.example.com/api/auth/login`
- Username: `api_user`
- Password: `api_pass`
- Token Field Name: `access_token`

**Step Configuration:**

1. **API Source:** Auth Config Only
2. **Authentication Config:** Select your DMS auth config
3. **URL:** `https://dms.example.com/api/v1/Documents/upload`
4. **Filename Template:** `{{extractedData.bolNumber}}_BOL.pdf`

**Form Parts:**

Part 1 (Text):
- Name: `metadata`
- Type: Text
- Content-Type: `application/json`
- Value:
```json
{
  "documentName": "",
  "documentType": "BOL",
  "referenceNumber": "",
  "shipperName": "",
  "consigneeName": "",
  "isActive": true
}
```
- Field Mappings:
  - `documentName` | Variable | `{{extractedData.bolNumber}}_BOL` | string
  - `referenceNumber` | Variable | `{{extractedData.bolNumber}}` | string
  - `shipperName` | Variable | `{{extractedData.shipperName}}` | string
  - `consigneeName` | Variable | `{{extractedData.consigneeName}}` | string

Part 2 (File):
- Name: `file`
- Type: File

**Response Data Mappings:**
- `data.documentId` -> `dmsDocumentId`

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Multipart form upload URL is required" | No URL configured and no base URL from API source | Provide a full URL or ensure your API source has a base URL configured |
| "Authentication login failed" | Auth config credentials are incorrect or endpoint is down | Verify your auth config login endpoint, username, and password |
| "Login response missing 'access_token' field" | Token field name doesn't match API response | Check the actual login response and update the token field name in your auth config |
| Field values not being replaced | Field mapping type is "Hardcoded" but should be "Variable" | Change the mapping type to "Variable" and use `{{variableName}}` syntax |
| JSON data types wrong (numbers sent as strings) | Data Type not set correctly | Set the Data Type to `integer`, `number`, or `boolean` as needed |
| Nested JSON fields not updating | Dot notation path doesn't match JSON structure | Verify the field path matches exactly (e.g., `properties.name` for `{ "properties": { "name": "" } }`) |
| File not attached | No PDF data in workflow context | Ensure a previous step in the workflow provides PDF data (extraction or transform) |

### Checking Execution Logs

After a workflow runs, check the **Workflow Execution Logs** in Settings. The multipart step logs include:
- The final constructed URL
- All form parts with their resolved values (file data shows as `[FILE DATA]`)
- File size in bytes
- Response status code
- Full response data from the API

---

## Notes

- The multipart step always sends a POST request
- The Content-Type header is automatically set to `multipart/form-data` with the boundary -- do not set it manually in additional headers
- PDF files are automatically given the `application/pdf` content type
- If no PDF data exists in the workflow context, the file part will be empty
- Variable placeholders in URLs are automatically URL-encoded
- The `.pdf` extension is automatically appended to filenames if missing
