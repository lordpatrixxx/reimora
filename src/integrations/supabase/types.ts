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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      advance_allocations: {
        Row: {
          advance_id: string
          allocated_by: string | null
          amount_paise: number
          claim_id: string
          created_at: string
          id: string
        }
        Insert: {
          advance_id: string
          allocated_by?: string | null
          amount_paise: number
          claim_id: string
          created_at?: string
          id?: string
        }
        Update: {
          advance_id?: string
          allocated_by?: string | null
          amount_paise?: number
          claim_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advance_allocations_advance_id_fkey"
            columns: ["advance_id"]
            isOneToOne: false
            referencedRelation: "advances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_allocations_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      advances: {
        Row: {
          allocated_paise: number
          amount_paise: number
          created_at: string
          id: string
          issued_on: string
          purpose: string
          recorded_by: string | null
          reference: string | null
          student_id: string
        }
        Insert: {
          allocated_paise?: number
          amount_paise: number
          created_at?: string
          id?: string
          issued_on?: string
          purpose: string
          recorded_by?: string | null
          reference?: string | null
          student_id: string
        }
        Update: {
          allocated_paise?: number
          amount_paise?: number
          created_at?: string
          id?: string
          issued_on?: string
          purpose?: string
          recorded_by?: string | null
          reference?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advances_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          claim_id: string
          created_at: string
          created_by: string | null
          expense_id: string
          file_name: string
          id: string
          kind: string
          mime_type: string
          rotation: number
          sha256: string | null
          size_bytes: number
          storage_path: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          created_by?: string | null
          expense_id: string
          file_name: string
          id?: string
          kind?: string
          mime_type: string
          rotation?: number
          sha256?: string | null
          size_bytes: number
          storage_path: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          created_by?: string | null
          expense_id?: string
          file_name?: string
          id?: string
          kind?: string
          mime_type?: string
          rotation?: number
          sha256?: string | null
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficiaries: {
        Row: {
          account_last4: string
          bank_name: string
          created_at: string
          holder_name: string
          id: string
          ifsc: string
          is_active: boolean
          is_default: boolean
          is_fictional: boolean
          student_id: string
        }
        Insert: {
          account_last4: string
          bank_name: string
          created_at?: string
          holder_name: string
          id?: string
          ifsc: string
          is_active?: boolean
          is_default?: boolean
          is_fictional?: boolean
          student_id: string
        }
        Update: {
          account_last4?: string
          bank_name?: string
          created_at?: string
          holder_name?: string
          id?: string
          ifsc?: string
          is_active?: boolean
          is_default?: boolean
          is_fictional?: boolean
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beneficiaries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficiary_history: {
        Row: {
          beneficiary_id: string
          changed_by: string | null
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          beneficiary_id: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          beneficiary_id?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: []
      }
      claim_events: {
        Row: {
          action: string
          actor: string | null
          actor_name: string | null
          claim_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["claim_status"] | null
          id: string
          note: string | null
          to_status: Database["public"]["Enums"]["claim_status"] | null
        }
        Insert: {
          action: string
          actor?: string | null
          actor_name?: string | null
          claim_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["claim_status"] | null
          id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["claim_status"] | null
        }
        Update: {
          action?: string
          actor?: string | null
          actor_name?: string | null
          claim_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["claim_status"] | null
          id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["claim_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_events_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          advance_applied_paise: number
          approved_paise: number | null
          assigned_faculty: string | null
          beneficiary_confirmed: boolean
          beneficiary_id: string | null
          beneficiary_snapshot: Json | null
          claimed_paise: number
          created_at: string
          created_by: string
          decided_at: string | null
          id: string
          purpose: string
          ref: string
          settlement_status: Database["public"]["Enums"]["settlement_status"]
          status: Database["public"]["Enums"]["claim_status"]
          student_id: string
          submitted_at: string | null
          title: string
          updated_at: string
          wizard_step: number
        }
        Insert: {
          advance_applied_paise?: number
          approved_paise?: number | null
          assigned_faculty?: string | null
          beneficiary_confirmed?: boolean
          beneficiary_id?: string | null
          beneficiary_snapshot?: Json | null
          claimed_paise?: number
          created_at?: string
          created_by?: string
          decided_at?: string | null
          id?: string
          purpose?: string
          ref?: string
          settlement_status?: Database["public"]["Enums"]["settlement_status"]
          status?: Database["public"]["Enums"]["claim_status"]
          student_id: string
          submitted_at?: string | null
          title: string
          updated_at?: string
          wizard_step?: number
        }
        Update: {
          advance_applied_paise?: number
          approved_paise?: number | null
          assigned_faculty?: string | null
          beneficiary_confirmed?: boolean
          beneficiary_id?: string | null
          beneficiary_snapshot?: Json | null
          claimed_paise?: number
          created_at?: string
          created_by?: string
          decided_at?: string | null
          id?: string
          purpose?: string
          ref?: string
          settlement_status?: Database["public"]["Enums"]["settlement_status"]
          status?: Database["public"]["Enums"]["claim_status"]
          student_id?: string
          submitted_at?: string | null
          title?: string
          updated_at?: string
          wizard_step?: number
        }
        Relationships: [
          {
            foreignKeyName: "claims_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_flags: {
        Row: {
          claim_id: string
          created_at: string
          expense_id: string | null
          id: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          expense_id?: string | null
          id?: string
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          expense_id?: string | null
          id?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_flags_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_flags_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_edits: {
        Row: {
          created_at: string
          edited_by: string | null
          expense_id: string
          id: string
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          created_at?: string
          edited_by?: string | null
          expense_id: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          created_at?: string
          edited_by?: string | null
          expense_id?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_edits_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount_paise: number | null
          approved_paise: number | null
          category: Database["public"]["Enums"]["expense_category"] | null
          claim_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          description: string
          expense_date: string | null
          extraction: Json | null
          extraction_at: string | null
          extraction_rescan: Json | null
          id: string
          invoice_no: string | null
          review_note: string | null
          txn_ref: string | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount_paise?: number | null
          approved_paise?: number | null
          category?: Database["public"]["Enums"]["expense_category"] | null
          claim_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          description?: string
          expense_date?: string | null
          extraction?: Json | null
          extraction_at?: string | null
          extraction_rescan?: Json | null
          id?: string
          invoice_no?: string | null
          review_note?: string | null
          txn_ref?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount_paise?: number | null
          approved_paise?: number | null
          category?: Database["public"]["Enums"]["expense_category"] | null
          claim_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          description?: string
          expense_date?: string | null
          extraction?: Json | null
          extraction_at?: string | null
          extraction_rescan?: Json | null
          id?: string
          invoice_no?: string | null
          review_note?: string | null
          txn_ref?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          attempts: number
          body: string
          claim_id: string | null
          created_at: string
          dedupe_key: string
          id: string
          kind: string
          last_error: string | null
          read_at: string | null
          recipient_email: string
          recipient_user: string | null
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          attempts?: number
          body: string
          claim_id?: string | null
          created_at?: string
          dedupe_key: string
          id?: string
          kind: string
          last_error?: string | null
          read_at?: string | null
          recipient_email: string
          recipient_user?: string | null
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          attempts?: number
          body?: string
          claim_id?: string | null
          created_at?: string
          dedupe_key?: string
          id?: string
          kind?: string
          last_error?: string | null
          read_at?: string | null
          recipient_email?: string
          recipient_user?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_paise: number
          beneficiary_snapshot: Json | null
          claim_id: string
          created_at: string
          direction: string
          id: string
          idempotency_key: string
          paid_on: string
          recorded_by: string | null
          recorded_by_name: string | null
          reference: string
        }
        Insert: {
          amount_paise: number
          beneficiary_snapshot?: Json | null
          claim_id: string
          created_at?: string
          direction: string
          id?: string
          idempotency_key: string
          paid_on: string
          recorded_by?: string | null
          recorded_by_name?: string | null
          reference: string
        }
        Update: {
          amount_paise?: number
          beneficiary_snapshot?: Json | null
          claim_id?: string
          created_at?: string
          direction?: string
          id?: string
          idempotency_key?: string
          paid_on?: string
          recorded_by?: string | null
          recorded_by_name?: string | null
          reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          college: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          requested_role: Database["public"]["Enums"]["app_role"] | null
        }
        Insert: {
          college?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          requested_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Update: {
          college?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          requested_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Relationships: []
      }
      students: {
        Row: {
          college: string | null
          created_at: string
          created_by: string | null
          department: string
          division: string | null
          email: string
          full_name: string
          id: string
          prn: string
          user_id: string | null
          year: string | null
        }
        Insert: {
          college?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          division?: string | null
          email: string
          full_name: string
          id?: string
          prn: string
          user_id?: string | null
          year?: string | null
        }
        Update: {
          college?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          division?: string | null
          email?: string
          full_name?: string
          id?: string
          prn?: string
          user_id?: string | null
          year?: string | null
        }
        Relationships: []
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
      actor_name: { Args: never; Returns: string }
      allocate_advance: {
        Args: { _advance: string; _amount: number; _claim: string }
        Returns: undefined
      }
      can_edit_claim: { Args: { _claim: string }; Returns: boolean }
      can_view_claim: { Args: { _claim: string }; Returns: boolean }
      college_for_email: { Args: { _email: string }; Returns: string }
      decide_claim: {
        Args: { _claim: string; _decision: string; _items: Json; _note: string }
        Returns: undefined
      }
      detect_duplicates: { Args: { _claim: string }; Returns: undefined }
      enqueue_notice: {
        Args: {
          _body: string
          _claim: string
          _dedupe: string
          _kind: string
          _subject: string
        }
        Returns: undefined
      }
      fmt_inr: { Args: { _p: number }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _uid: string }; Returns: boolean }
      my_student_id: { Args: never; Returns: string }
      recompute_settlement: { Args: { _claim: string }; Returns: undefined }
      record_payment: {
        Args: {
          _amount: number
          _claim: string
          _direction: string
          _key: string
          _paid_on: string
          _reference: string
        }
        Returns: undefined
      }
      request_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      resolve_flag: {
        Args: { _flag: string; _resolution: string }
        Returns: undefined
      }
      set_user_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      start_review: { Args: { _claim: string }; Returns: undefined }
      submit_claim: { Args: { _claim: string }; Returns: undefined }
    }
    Enums: {
      app_role: "student" | "faculty" | "finance"
      claim_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "changes_requested"
        | "rejected"
        | "approved"
      expense_category:
        | "Stationery"
        | "Refreshment"
        | "Rent"
        | "Design Material"
        | "Printing"
        | "Travel"
        | "Equipment"
        | "Other"
      settlement_status:
        | "not_applicable"
        | "pending"
        | "partially_settled"
        | "settled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["student", "faculty", "finance"],
      claim_status: [
        "draft",
        "submitted",
        "under_review",
        "changes_requested",
        "rejected",
        "approved",
      ],
      expense_category: [
        "Stationery",
        "Refreshment",
        "Rent",
        "Design Material",
        "Printing",
        "Travel",
        "Equipment",
        "Other",
      ],
      settlement_status: [
        "not_applicable",
        "pending",
        "partially_settled",
        "settled",
      ],
    },
  },
} as const
