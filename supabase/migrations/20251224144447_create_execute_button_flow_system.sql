/*
  # Create Execute Button Flow System

  This migration creates the visual flow designer system for execute buttons.
  It allows users to create visual workflows using React Flow where Groups (user input forms)
  and Workflow steps (API calls, branches, etc.) can be connected on a canvas.

  1. New Tables
    - `execute_button_flow_nodes`
      - `id` (uuid, primary key)
      - `button_id` (uuid, foreign key to execute_buttons)
      - `node_type` (text) - 'group' or 'workflow'
      - `position_x` (float) - X position on canvas
      - `position_y` (float) - Y position on canvas
      - `width` (float) - Node width (optional)
      - `height` (float) - Node height (optional)
      - `label` (text) - Display label for the node
      - `group_id` (uuid) - Reference to execute_button_groups for group nodes
      - `step_type` (text) - Step type for workflow nodes (api_endpoint, conditional_check, etc.)
      - `config_json` (jsonb) - Configuration for workflow nodes
      - `created_at`, `updated_at` (timestamptz)

    - `execute_button_flow_edges`
      - `id` (uuid, primary key)
      - `button_id` (uuid, foreign key to execute_buttons)
      - `source_node_id` (uuid, foreign key to flow_nodes)
      - `target_node_id` (uuid, foreign key to flow_nodes)
      - `source_handle` (text) - Handle ID for source ('default', 'success', 'failure')
      - `target_handle` (text) - Handle ID for target
      - `label` (text) - Optional edge label
      - `edge_type` (text) - Edge style type
      - `animated` (boolean) - Whether edge is animated
      - `created_at`, `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add public access policies (custom auth system)

  3. Indexes
    - Index on button_id for both tables
    - Index on group_id for flow_nodes
*/

-- Create execute_button_flow_nodes table
CREATE TABLE IF NOT EXISTS execute_button_flow_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  button_id uuid NOT NULL REFERENCES execute_buttons(id) ON DELETE CASCADE,
  node_type text NOT NULL CHECK (node_type IN ('group', 'workflow')),
  position_x float NOT NULL DEFAULT 0,
  position_y float NOT NULL DEFAULT 0,
  width float,
  height float,
  label text NOT NULL,
  group_id uuid REFERENCES execute_button_groups(id) ON DELETE CASCADE,
  step_type text CHECK (step_type IS NULL OR step_type IN ('api_call', 'api_endpoint', 'conditional_check', 'data_transform', 'sftp_upload', 'email_action', 'rename_file', 'branch')),
  config_json jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create execute_button_flow_edges table
CREATE TABLE IF NOT EXISTS execute_button_flow_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  button_id uuid NOT NULL REFERENCES execute_buttons(id) ON DELETE CASCADE,
  source_node_id uuid NOT NULL REFERENCES execute_button_flow_nodes(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES execute_button_flow_nodes(id) ON DELETE CASCADE,
  source_handle text DEFAULT 'default',
  target_handle text DEFAULT 'default',
  label text,
  edge_type text DEFAULT 'default',
  animated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE execute_button_flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE execute_button_flow_edges ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for execute_button_flow_nodes
CREATE POLICY "Allow public read access to execute_button_flow_nodes"
  ON execute_button_flow_nodes FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert access to execute_button_flow_nodes"
  ON execute_button_flow_nodes FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update access to execute_button_flow_nodes"
  ON execute_button_flow_nodes FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to execute_button_flow_nodes"
  ON execute_button_flow_nodes FOR DELETE TO public USING (true);

-- Create RLS policies for execute_button_flow_edges
CREATE POLICY "Allow public read access to execute_button_flow_edges"
  ON execute_button_flow_edges FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert access to execute_button_flow_edges"
  ON execute_button_flow_edges FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update access to execute_button_flow_edges"
  ON execute_button_flow_edges FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to execute_button_flow_edges"
  ON execute_button_flow_edges FOR DELETE TO public USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_execute_button_flow_nodes_button_id ON execute_button_flow_nodes(button_id);
CREATE INDEX IF NOT EXISTS idx_execute_button_flow_nodes_group_id ON execute_button_flow_nodes(group_id);
CREATE INDEX IF NOT EXISTS idx_execute_button_flow_nodes_type ON execute_button_flow_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_execute_button_flow_edges_button_id ON execute_button_flow_edges(button_id);
CREATE INDEX IF NOT EXISTS idx_execute_button_flow_edges_source ON execute_button_flow_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_execute_button_flow_edges_target ON execute_button_flow_edges(target_node_id);

-- Add has_flow column to execute_buttons to track if a button uses flow mode
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'execute_buttons' AND column_name = 'has_flow'
  ) THEN
    ALTER TABLE execute_buttons ADD COLUMN has_flow boolean DEFAULT false;
  END IF;
END $$;
