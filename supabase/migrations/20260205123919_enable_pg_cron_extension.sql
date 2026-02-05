/*
  # Enable pg_cron Extension

  1. Changes
    - Enables the pg_cron extension for scheduled job execution
    - Required for the scheduled email monitoring feature

  2. Notes
    - pg_cron is available on Supabase Pro plans and above
    - This extension allows scheduling PostgreSQL functions to run on a cron schedule
*/

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;