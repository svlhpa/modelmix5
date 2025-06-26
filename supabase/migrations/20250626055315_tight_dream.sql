/*
  # Add Orchestration Tables

  1. New Tables
    - `projects`
      - `id` (uuid, primary key)
      - `title` (text)
      - `user_id` (uuid, references user_profiles)
      - `original_prompt` (text)
      - `status` (text) - 'draft', 'planning', 'writing', 'reviewing', 'completed', 'paused', 'error'
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `project_metadata`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `audience` (text)
      - `tone` (text)
      - `purpose` (text)
      - `doc_type` (text)
      - `word_count` (integer)
      - `created_at` (timestamp)
    
    - `sections`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `title` (text)
      - `assigned_model` (text)
      - `token_budget` (integer)
      - `status` (text) - 'pending', 'writing', 'completed', 'error'
      - `order` (integer)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `section_outputs`
      - `id` (uuid, primary key)
      - `section_id` (uuid, references sections)
      - `raw_output` (text)
      - `ai_notes` (text)
      - `is_finalized` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `final_exports`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `format` (text) - 'pdf', 'markdown', 'docx'
      - `exported_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for users to access their own data
    - Add superadmin access to all data
*/

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  original_prompt text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create project_metadata table
CREATE TABLE IF NOT EXISTS project_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  audience text,
  tone text,
  purpose text,
  doc_type text,
  word_count integer DEFAULT 5000,
  created_at timestamptz DEFAULT now()
);

-- Create sections table
CREATE TABLE IF NOT EXISTS sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  assigned_model text NOT NULL,
  token_budget integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  "order" integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create section_outputs table
CREATE TABLE IF NOT EXISTS section_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid REFERENCES sections(id) ON DELETE CASCADE NOT NULL,
  raw_output text NOT NULL,
  ai_notes text,
  is_finalized boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create final_exports table
CREATE TABLE IF NOT EXISTS final_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  format text NOT NULL,
  exported_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_exports ENABLE ROW LEVEL SECURITY;

-- Create policies for projects
CREATE POLICY "Users can manage own projects or superadmin can manage all"
  ON projects
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR is_superadmin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_superadmin(auth.uid()));

-- Create policies for project_metadata
CREATE POLICY "Users can manage own project metadata or superadmin can manage all"
  ON project_metadata
  FOR ALL
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    ) OR is_superadmin(auth.uid())
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    ) OR is_superadmin(auth.uid())
  );

-- Create policies for sections
CREATE POLICY "Users can manage own sections or superadmin can manage all"
  ON sections
  FOR ALL
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    ) OR is_superadmin(auth.uid())
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    ) OR is_superadmin(auth.uid())
  );

-- Create policies for section_outputs
CREATE POLICY "Users can manage own section outputs or superadmin can manage all"
  ON section_outputs
  FOR ALL
  TO authenticated
  USING (
    section_id IN (
      SELECT id FROM sections WHERE project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
      )
    ) OR is_superadmin(auth.uid())
  )
  WITH CHECK (
    section_id IN (
      SELECT id FROM sections WHERE project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
      )
    ) OR is_superadmin(auth.uid())
  );

-- Create policies for final_exports
CREATE POLICY "Users can manage own exports or superadmin can manage all"
  ON final_exports
  FOR ALL
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    ) OR is_superadmin(auth.uid())
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    ) OR is_superadmin(auth.uid())
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_project_metadata_project_id ON project_metadata(project_id);
CREATE INDEX IF NOT EXISTS idx_sections_project_id ON sections(project_id);
CREATE INDEX IF NOT EXISTS idx_sections_order ON sections("order");
CREATE INDEX IF NOT EXISTS idx_section_outputs_section_id ON section_outputs(section_id);
CREATE INDEX IF NOT EXISTS idx_final_exports_project_id ON final_exports(project_id);