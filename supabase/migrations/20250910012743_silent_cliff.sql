/*
  # Restore Deleted Workflow Steps

  This migration restores the workflow steps that were accidentally deleted during the save operation.
  
  1. Restored Steps
     - Step 1: Get Consignee Client ID (API call to check existing client)
     - Step 2: Check Client ID (conditional check if client exists)
     - Step 3: Create New Consignee Client (API call to create client if not found)
     - Step 4: Send Updated JSON to Main API (API call to send final data)
  
  2. Workflow Logic
     - Gets existing client ID, creates new client if needed, then sends final data
     - Uses conditional branching based on whether client exists
     - All steps properly configured with TruckMate API endpoints
*/

-- Restore the deleted workflow steps
INSERT INTO workflow_steps (
  id, 
  workflow_id, 
  step_order, 
  step_type, 
  step_name, 
  config_json, 
  next_step_on_success_id, 
  next_step_on_failure_id, 
  created_at, 
  updated_at
) VALUES 
(
  '5b7aa79e-fc83-47fa-9d30-2da7e025f113', 
  '1809426b-4a37-4319-8ef4-1da21005c4d4', 
  4, 
  'api_call', 
  'Send Updated JSON to Main API', 
  '{"url":"https://honxpsrest.tmwcloud.com/tm/orders","headers":{"Content-Type":"application/json","Authorization":"Bearer a3283b0bac78a0e41b1a05e0cb73ed5d"},"requestBody":"{{extractedData}}"}', 
  null, 
  null, 
  '2025-09-08 23:08:42.587347+00', 
  '2025-09-09 19:41:41.412+00'
),
(
  '772325f6-a4b7-429c-b2b7-11c6e4f6667c', 
  '1809426b-4a37-4319-8ef4-1da21005c4d4', 
  2, 
  'conditional_check', 
  'Check Client ID', 
  '{"jsonPath":"orders.0.consignee.clientId","conditionType":"is_not_null"}', 
  '5b7aa79e-fc83-47fa-9d30-2da7e025f113', 
  'f17a3b18-9e77-4d5e-a79d-1958fd1f73e4', 
  '2025-09-08 23:08:35.780123+00', 
  '2025-09-09 19:41:41.412+00'
),
(
  'f17a3b18-9e77-4d5e-a79d-1958fd1f73e4', 
  '1809426b-4a37-4319-8ef4-1da21005c4d4', 
  3, 
  'api_call', 
  'Create New Consignee Client', 
  '{"url":"https://honxpsrest.tmwcloud.com/masterData/clients","headers":{"Content-Type":"application/json","Authorization":"Bearer a3283b0bac78a0e41b1a05e0cb73ed5d"},"requestBody":"{\n  \"clients\": [\n    {\n      \"name\": \"{{orders.0.consignee.name}}\",\n      \"address1\": \"{{orders.0.consignee.address1}}\",\n      \"city\": \"{{orders.0.consignee.city}}\",\n      \"province\": \"{{orders.0.consignee.province}}\",\n      \"postalCode\": \"{{orders.0.consignee.postalCode}}\",\n      \"deliveryZone\": \"{{orders.0.consignee.postalCode}}\"\n    }\n  ]\n}\n","updateJsonPath":"orders.0.consignee.clientId","responseDataPath":"clients[0].clientId"}', 
  null, 
  null, 
  '2025-09-08 23:08:40.345338+00', 
  '2025-09-09 19:41:41.412+00'
),
(
  'fb8cadd4-cc56-4248-889d-f936c7b4d72a', 
  '1809426b-4a37-4319-8ef4-1da21005c4d4', 
  1, 
  'api_call', 
  'Get Consignee Client ID', 
  '{"url":"https://honxpsrest.tmwcloud.com/masterData/clients?$filter=name eq ''{{orders.0.consignee.name}}'' and address1 eq ''{{orders.0.consignee.address1}}'' and isInactive eq ''False'' &$limit=1&$select=clientId,Name,address1","method":"GET","headers":{"Content-Type":"application/json","Authorization":"Bearer a3283b0bac78a0e41b1a05e0cb73ed5d"},"updateJsonPath":"orders.0.consignee.clientId","responseDataPath":"clients[0].clientId"}', 
  null, 
  null, 
  '2025-09-08 23:07:23.693702+00', 
  '2025-09-09 19:41:41.412+00'
)
ON CONFLICT (id) DO NOTHING;