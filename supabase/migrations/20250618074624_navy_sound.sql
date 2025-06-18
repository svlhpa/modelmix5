/*
  # Add Memory System Tables

  1. New Tables
    - `user_memories`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `session_id` (uuid, references chat_sessions)
      - `key` (text) - type of memory (user_name, preference, etc.)
      - `value` (text) - the actual memory content
      - `context` (text) - context where this memory was extracted
      - `importance` (integer) - importance score 1-10
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `expires_at` (timestamp, optional)
    
    - `conversation_summaries`
      - `id` (uuid, primary key)
      - `session_id` (uuid, references chat_sessions)
      - `summary` (text) - conversation summary
      - `key_points` (text[]) - array of key points
      - `participants` (text[]) - array of participants
      - `topics` (text[]) - array of topics discussed
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for users to access their own memories
    - Add superadmin access to all memory data
*/

-- Create user_memories table
CREATE TABLE IF NOT EXISTS user_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  context text NOT NULL,
  importance integer NOT NULL DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  UNIQUE(user_id, key, value)
);

-- Create conversation_summaries table
CREATE TABLE IF NOT EXISTS conversation_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  summary text NOT NULL,
  key_points text[] DEFAULT '{}',
  participants text[] DEFAULT '{}',
  topics text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id)
);

-- Enable RLS on memory tables
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;

-- Create policies for user_memories
CREATE POLICY "Users can manage own memories or superadmin can manage all"
  ON user_memories
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR is_superadmin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_superadmin(auth.uid()));

-- Create policies for conversation_summaries
CREATE POLICY "Users can manage own conversation summaries or superadmin can manage all"
  ON conversation_summaries
  FOR ALL
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM chat_sessions WHERE user_id = auth.uid()
    ) OR is_superadmin(auth.uid())
  )
  WITH CHECK (
    session_id IN (
      SELECT id FROM chat_sessions WHERE user_id = auth.uid()
    ) OR is_superadmin(auth.uid())
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_memories_user_id ON user_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memories_session_id ON user_memories(session_id);
CREATE INDEX IF NOT EXISTS idx_user_memories_importance ON user_memories(importance);
CREATE INDEX IF NOT EXISTS idx_user_memories_key ON user_memories(key);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_session_id ON conversation_summaries(session_id);