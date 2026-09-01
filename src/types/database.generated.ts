export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string
          details: Json
          exam_id: number | null
          id: number
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json
          exam_id?: number | null
          id?: number
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json
          exam_id?: number | null
          id?: number
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      answer_keys: {
        Row: {
          answer: string
          exam_subject_id: number
          id: number
          points: number
          question_number: number
        }
        Insert: {
          answer: string
          exam_subject_id: number
          id?: number
          points: number
          question_number: number
        }
        Update: {
          answer?: string
          exam_subject_id?: number
          id?: number
          points?: number
          question_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "answer_keys_exam_subject_id_fkey"
            columns: ["exam_subject_id"]
            isOneToOne: false
            referencedRelation: "exam_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      answer_key_reports: {
        Row: {
          created_at: string
          details: string
          exam_subject_id: number
          id: number
          issue_type: string
          question_number: number
          reporter_user_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string
          exam_subject_id: number
          id?: number
          issue_type: string
          question_number: number
          reporter_user_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string
          exam_subject_id?: number
          id?: number
          issue_type?: string
          question_number?: number
          reporter_user_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_key_reports_exam_subject_id_fkey"
            columns: ["exam_subject_id"]
            isOneToOne: false
            referencedRelation: "exam_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          answers: Json
          created_at: string
          exam_subject_id: number
          graded_at: string | null
          id: string
          is_current: boolean
          remaining_seconds: number | null
          round_number: number
          score: number | null
          status: Database["public"]["Enums"]["attempt_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          exam_subject_id: number
          graded_at?: string | null
          id?: string
          is_current?: boolean
          remaining_seconds?: number | null
          round_number?: number
          score?: number | null
          status?: Database["public"]["Enums"]["attempt_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          exam_subject_id?: number
          graded_at?: string | null
          id?: string
          is_current?: boolean
          remaining_seconds?: number | null
          round_number?: number
          score?: number | null
          status?: Database["public"]["Enums"]["attempt_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempts_exam_subject_id_fkey"
            columns: ["exam_subject_id"]
            isOneToOne: false
            referencedRelation: "exam_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_subjects: {
        Row: {
          created_at: string
          exam_id: number
          explanation_pdf_path: string | null
          id: number
          published_at: string | null
          question_pdf_path: string | null
          status: Database["public"]["Enums"]["exam_status"]
          subject_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          exam_id: number
          explanation_pdf_path?: string | null
          id?: number
          published_at?: string | null
          question_pdf_path?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          subject_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          exam_id?: number
          explanation_pdf_path?: string | null
          id?: number
          published_at?: string | null
          question_pdf_path?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          subject_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_subjects_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          created_at: string
          id: number
          is_development_data: boolean
          month: number
          published_at: string | null
          status: Database["public"]["Enums"]["exam_status"]
          title: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: number
          is_development_data?: boolean
          month: number
          published_at?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          title: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: number
          is_development_data?: boolean
          month?: number
          published_at?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          title?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          theme: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          theme?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          area: string
          created_at: string
          duration_seconds: number
          id: number
          name: string
          question_count: number
          sort_order: number
        }
        Insert: {
          area: string
          created_at?: string
          duration_seconds: number
          id?: number
          name: string
          question_count: number
          sort_order?: number
        }
        Update: {
          area?: string
          created_at?: string
          duration_seconds?: number
          id?: number
          name?: string
          question_count?: number
          sort_order?: number
        }
        Relationships: []
      }
      user_shortcuts: {
        Row: {
          created_at: string
          subject_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          subject_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          subject_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_shortcuts_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      start_next_attempt_round: {
        Args: { p_exam_subject_id: number }
        Returns: Database['public']['Tables']['attempts']['Row']
      }
    }
    Enums: {
      attempt_status: "new" | "doing" | "done"
      exam_status: "draft" | "published"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      attempt_status: ["new", "doing", "done"],
      exam_status: ["draft", "published"],
    },
  },
} as const
