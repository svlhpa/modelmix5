export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
          role: string | null;
          current_tier: string | null;
          monthly_conversations: number | null;
          last_reset_date: string | null;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
          role?: string | null;
          current_tier?: string | null;
          monthly_conversations?: number | null;
          last_reset_date?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
          role?: string | null;
          current_tier?: string | null;
          monthly_conversations?: number | null;
          last_reset_date?: string | null;
        };
      };
      user_api_settings: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          api_key: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: string;
          api_key: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider?: string;
          api_key?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      chat_sessions: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      conversation_turns: {
        Row: {
          id: string;
          session_id: string;
          user_message: string;
          selected_provider: string | null;
          selected_response: string | null;
          created_at: string;
          user_images: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_message: string;
          selected_provider?: string | null;
          selected_response?: string | null;
          created_at?: string;
          user_images?: string | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_message?: string;
          selected_provider?: string | null;
          selected_response?: string | null;
          created_at?: string;
          user_images?: string | null;
        };
      };
      provider_analytics: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          total_selections: number;
          total_responses: number;
          selection_rate: number;
          error_count: number;
          last_used: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: string;
          total_selections?: number;
          total_responses?: number;
          selection_rate?: number;
          error_count?: number;
          last_used?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider?: string;
          total_selections?: number;
          total_responses?: number;
          selection_rate?: number;
          error_count?: number;
          last_used?: string;
          updated_at?: string;
        };
      };
      admin_activity_logs: {
        Row: {
          id: string;
          admin_user_id: string;
          action: string;
          target_user_id: string | null;
          details: any | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_user_id: string;
          action: string;
          target_user_id?: string | null;
          details?: any | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_user_id?: string;
          action?: string;
          target_user_id?: string | null;
          details?: any | null;
          created_at?: string;
        };
      };
      user_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          tier: string;
          status: string;
          started_at: string;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tier: string;
          status?: string;
          started_at?: string;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          tier?: string;
          status?: string;
          started_at?: string;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      global_api_keys: {
        Row: {
          id: string;
          provider: string;
          api_key: string;
          tier_access: string[];
          is_active: boolean | null;
          usage_limit: number | null;
          current_usage: number | null;
          last_reset_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          api_key: string;
          tier_access?: string[];
          is_active?: boolean | null;
          usage_limit?: number | null;
          current_usage?: number | null;
          last_reset_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider?: string;
          api_key?: string;
          tier_access?: string[];
          is_active?: boolean | null;
          usage_limit?: number | null;
          current_usage?: number | null;
          last_reset_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}