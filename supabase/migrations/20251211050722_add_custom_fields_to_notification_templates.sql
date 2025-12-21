/*
  # Add Custom Fields to Notification Templates

  1. Changes
    - Adds `custom_fields` JSONB column to `notification_templates` table
    - Custom fields allow templates to define dynamic placeholder variables
    - Each custom field has: name (variable name), label (display label), description (optional)
  
  2. Purpose
    - Enables notification templates to define custom variables
    - Workflow steps can map response data from previous steps to these custom fields
    - Provides flexibility to use API response data in notification emails

  3. Example custom_fields value:
    [
      {"name": "order_number", "label": "Order Number", "description": "The order ID from API response"},
      {"name": "customer_name", "label": "Customer Name"}
    ]
*/

ALTER TABLE notification_templates
ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '[]'::jsonb;