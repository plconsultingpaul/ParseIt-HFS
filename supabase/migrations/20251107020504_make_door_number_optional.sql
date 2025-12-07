/*
  # Make Door Number Optional in Driver Check-In

  ## Summary
  Updates the driver_checkin_logs table to make the door_number field optional,
  allowing drivers to complete check-in without providing a door number.

  ## Changes
  - Remove NOT NULL constraint from door_number column
  - Remove default value from door_number column
  - Column now accepts NULL values when door number is not assigned

  ## Impact
  - Existing records with door_number = 0 will remain unchanged
  - New check-ins can omit door number (stored as NULL)
  - No data loss or breaking changes to existing functionality
*/

-- Make door_number nullable in driver_checkin_logs
ALTER TABLE driver_checkin_logs 
  ALTER COLUMN door_number DROP NOT NULL,
  ALTER COLUMN door_number DROP DEFAULT;
