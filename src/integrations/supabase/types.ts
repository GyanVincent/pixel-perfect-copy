export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      practice_answers: {
        Row: {
          answered_at: string
          id: string
          is_correct: boolean
          question_id: string
          selected_answer: number
          session_id: string
          time_spent_seconds: number | null
          user_id: string
        }
        Insert: {
          answered_at?: string
          id?: string
          is_correct: boolean
          question_id: string
          selected_answer: number
          session_id: string
          time_spent_seconds?: number | null
          user_id: string
        }
        Update: {
          answered_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_answer?: number
          session_id?: string
          time_spent_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "practice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_sessions: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          correct_answers: number
          group_id: string | null
          id: string
          started_at: string
          subject_id: string | null
          time_spent_seconds: number | null
          topic_id: string | null
          total_questions: number
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          correct_answers?: number
          group_id?: string | null
          id?: string
          started_at?: string
          subject_id?: string | null
          time_spent_seconds?: number | null
          topic_id?: string | null
          total_questions?: number
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          correct_answers?: number
          group_id?: string | null
          id?: string
          started_at?: string
          subject_id?: string | null
          time_spent_seconds?: number | null
          topic_id?: string | null
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_sessions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          full_name: string
          id: string
          last_active_date: string | null
          level: string | null
          streak_days: number | null
          total_questions_answered: number | null
          university: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          full_name?: string
          id?: string
          last_active_date?: string | null
          level?: string | null
          streak_days?: number | null
          total_questions_answered?: number | null
          university?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          full_name?: string
          id?: string
          last_active_date?: string | null
          level?: string | null
          streak_days?: number | null
          total_questions_answered?: number | null
          university?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          bloom_level: string | null
          correct_answer: number
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          explanation: string | null
          id: string
          options: Json
          question_text: string
          topic_id: string
        }
        Insert: {
          bloom_level?: string | null
          correct_answer: number
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          explanation?: string | null
          id?: string
          options?: Json
          question_text: string
          topic_id: string
        }
        Update: {
          bloom_level?: string | null
          correct_answer?: number
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          explanation?: string | null
          id?: string
          options?: Json
          question_text?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      spaced_repetition: {
        Row: {
          ease_factor: number
          id: string
          interval_days: number
          last_reviewed: string | null
          next_review: string
          question_id: string
          repetitions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ease_factor?: number
          id?: string
          interval_days?: number
          last_reviewed?: string | null
          next_review?: string
          question_id: string
          repetitions?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ease_factor?: number
          id?: string
          interval_days?: number
          last_reviewed?: string | null
          next_review?: string
          question_id?: string
          repetitions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spaced_repetition_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      study_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      study_group_messages: {
        Row: {
          content: string
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      study_group_resources: {
        Row: {
          created_at: string
          group_id: string
          id: string
          notes: string | null
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          notes?: string | null
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          notes?: string | null
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_group_resources_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      study_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          invite_code: string
          name: string
          owner_id: string
          subject_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          invite_code: string
          name: string
          owner_id: string
          subject_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
          subject_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_groups_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string
          color: string
          created_at: string
          description: string | null
          icon: string
          id: string
          level: string
          name: string
          semester: number
          total_topics: number | null
        }
        Insert: {
          code: string
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          level?: string
          name: string
          semester?: number
          total_topics?: number | null
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          level?: string
          name?: string
          semester?: number
          total_topics?: number | null
        }
        Relationships: []
      }
      topics: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number | null
          subject_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_index?: number | null
          subject_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number | null
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_conversations: {
        Row: {
          created_at: string
          id: string
          subject_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subject_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subject_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_conversations_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          image_url: string | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "tutor_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          id: string
          last_practiced: string | null
          mastery_level: number | null
          questions_attempted: number | null
          questions_correct: number | null
          topic_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          last_practiced?: string | null
          mastery_level?: number | null
          questions_attempted?: number | null
          questions_correct?: number | null
          topic_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          last_practiced?: string | null
          mastery_level?: number | null
          questions_attempted?: number | null
          questions_correct?: number | null
          topic_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_invite_code: { Args: never; Returns: string }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_owner: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      difficulty_level: "easy" | "medium" | "hard"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      difficulty_level: ["easy", "medium", "hard"],
    },
  },
} as const
