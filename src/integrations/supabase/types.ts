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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_users: {
        Row: {
          id: string
          email: string
          password_hash: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          password_hash: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          password_hash?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      candidates: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string | null
          phone: string | null
          recruiter_id: string | null
          resume_url: string | null
          status: Database["public"]["Enums"]["candidate_status"] | null
          visa_status: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name?: string | null
          phone?: string | null
          recruiter_id?: string | null
          resume_url?: string | null
          status?: Database["public"]["Enums"]["candidate_status"] | null
          visa_status?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string | null
          phone?: string | null
          recruiter_id?: string | null
          resume_url?: string | null
          status?: Database["public"]["Enums"]["candidate_status"] | null
          visa_status?: string | null
        }
        Relationships: []
      }
      interview_reschedule_logs: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          interview_id: string
          new_date: string | null
          old_date: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          interview_id: string
          new_date?: string | null
          old_date?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          interview_id?: string
          new_date?: string | null
          old_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_reschedule_logs_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          candidate_id: string
          created_at: string | null
          feedback: string | null
          id: string
          mode: Database["public"]["Enums"]["interview_mode"] | null
          round_number: number | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["interview_status"] | null
          submission_id: string
          virtual_link: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string | null
          feedback?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["interview_mode"] | null
          round_number?: number | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["interview_status"] | null
          submission_id: string
          virtual_link?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string | null
          feedback?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["interview_mode"] | null
          round_number?: number | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["interview_status"] | null
          submission_id?: string
          virtual_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          candidate_id: string
          id: string
          offered_at: string | null
          salary: number | null
          status: Database["public"]["Enums"]["offer_status"] | null
          submission_id: string
        }
        Insert: {
          candidate_id: string
          id?: string
          offered_at?: string | null
          salary?: number | null
          status?: Database["public"]["Enums"]["offer_status"] | null
          submission_id: string
        }
        Update: {
          candidate_id?: string
          id?: string
          offered_at?: string | null
          salary?: number | null
          status?: Database["public"]["Enums"]["offer_status"] | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          linked_candidate_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          linked_candidate_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          linked_candidate_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_linked_candidate"
            columns: ["linked_candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          candidate_id: string
          client_name: string
          created_at: string | null
          id: string
          position: string
          recruiter_id: string | null
          status: Database["public"]["Enums"]["submission_status"] | null
        }
        Insert: {
          candidate_id: string
          client_name: string
          created_at?: string | null
          id?: string
          position: string
          recruiter_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"] | null
        }
        Update: {
          candidate_id?: string
          client_name?: string
          created_at?: string | null
          id?: string
          position?: string
          recruiter_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      login: {
        Args: { p_email: string; p_password: string }
        Returns: Json
      }
      create_app_user: {
        Args: {
          p_admin_user_id: string
          p_email: string
          p_password: string
          p_full_name: string
          p_role: string
        }
        Returns: Json
      }
      can_access_candidate: {
        Args: { _candidate_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_linked_candidate: {
        Args: { _candidate_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "recruiter" | "candidate" | "manager"
      candidate_status:
        | "New"
        | "In Marketing"
        | "Placed"
        | "Backout"
        | "On Bench"
        | "In Training"
      interview_mode: "Virtual" | "Onsite" | "Phone"
      interview_status: "Scheduled" | "Passed" | "Rejected" | "Rescheduled"
      offer_status: "Pending" | "Accepted" | "Declined"
      submission_status:
        | "Applied"
        | "Screen Call"
        | "Interview"
        | "Rejected"
        | "Offered"
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
      app_role: ["admin", "recruiter", "candidate", "manager"],
      candidate_status: [
        "New",
        "In Marketing",
        "Placed",
        "Backout",
        "On Bench",
        "In Training",
      ],
      interview_mode: ["Virtual", "Onsite", "Phone"],
      interview_status: ["Scheduled", "Passed", "Rejected", "Rescheduled"],
      offer_status: ["Pending", "Accepted", "Declined"],
      submission_status: [
        "Applied",
        "Screen Call",
        "Interview",
        "Rejected",
        "Offered",
      ],
    },
  },
} as const
