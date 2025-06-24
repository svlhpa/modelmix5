-- Insert a global Eleven Labs API key
INSERT INTO global_api_keys (
  provider,
  api_key,
  tier_access,
  is_active,
  usage_limit,
  current_usage,
  last_reset_date,
  created_at,
  updated_at
) VALUES (
  'elevenlabs',
  '', -- Admin will need to add the actual API key
  ARRAY['tier1', 'tier2'], -- Available to both free and pro users
  true,
  5000, -- 5000 TTS requests per month limit
  0,
  now(),
  now(),
  now()
) ON CONFLICT (provider) DO NOTHING;

-- Insert a global OpenAI Whisper API key for speech-to-text
INSERT INTO global_api_keys (
  provider,
  api_key,
  tier_access,
  is_active,
  usage_limit,
  current_usage,
  last_reset_date,
  created_at,
  updated_at
) VALUES (
  'openai_whisper',
  '', -- Admin will need to add the actual API key (can use regular OpenAI key)
  ARRAY['tier1', 'tier2'], -- Available to both free and pro users
  true,
  5000, -- 5000 STT requests per month limit
  0,
  now(),
  now(),
  now()
) ON CONFLICT (provider) DO NOTHING;