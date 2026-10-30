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
      chat_messages: {
        Row: {
          attachment_path: string | null
          created_at: string
          id: string
          is_from_admin: boolean
          message: string
          user_id: string
        }
        Insert: {
          attachment_path?: string | null
          created_at?: string
          id?: string
          is_from_admin?: boolean
          message: string
          user_id: string
        }
        Update: {
          attachment_path?: string | null
          created_at?: string
          id?: string
          is_from_admin?: boolean
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price_rwf: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          unit_price_rwf: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price_rwf?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
      orders: {
        Row: {
          address: string
          anonymous: boolean
          archived_at: string | null
          cancelled_reason: string | null
          carrier: string | null
          city: string
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          delivery_notes: string | null
          display_currency: string
          expires_at: string | null
          hidden_by_customer_at: string | null
          id: string
          order_code: string | null
          paid_amount_rwf: number | null
          paid_at: string | null
          pawapay_deposit_id: string | null
          payer_phone: string | null
          payment_failure: string | null
          payment_method: string
          payment_provider: string | null
          pickup_option: boolean
          refund_status: string | null
          shipping_rwf: number
          status: string
          stock_reserved: boolean
          subtotal_rwf: number
          total_rwf: number
          tracking_number: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address: string
          anonymous?: boolean
          archived_at?: string | null
          cancelled_reason?: string | null
          carrier?: string | null
          city: string
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          delivery_notes?: string | null
          display_currency?: string
          expires_at?: string | null
          hidden_by_customer_at?: string | null
          id?: string
          order_code?: string | null
          paid_amount_rwf?: number | null
          paid_at?: string | null
          pawapay_deposit_id?: string | null
          payer_phone?: string | null
          payment_failure?: string | null
          payment_method?: string
          payment_provider?: string | null
          pickup_option?: boolean
          refund_status?: string | null
          shipping_rwf?: number
          status?: string
          stock_reserved?: boolean
          subtotal_rwf: number
          total_rwf: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string
          anonymous?: boolean
          archived_at?: string | null
          cancelled_reason?: string | null
          carrier?: string | null
          city?: string
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          delivery_notes?: string | null
          display_currency?: string
          expires_at?: string | null
          hidden_by_customer_at?: string | null
          id?: string
          order_code?: string | null
          paid_amount_rwf?: number | null
          paid_at?: string | null
          pawapay_deposit_id?: string | null
          payer_phone?: string | null
          payment_failure?: string | null
          payment_method?: string
          payment_provider?: string | null
          pickup_option?: boolean
          refund_status?: string | null
          shipping_rwf?: number
          status?: string
          stock_reserved?: boolean
          subtotal_rwf?: number
          total_rwf?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          amount_rwf: number | null
          created_at: string
          currency: string | null
          deposit_id: string
          failure_code: string | null
          id: string
          order_id: string
          raw: Json | null
          status: string
        }
        Insert: {
          amount_rwf?: number | null
          created_at?: string
          currency?: string | null
          deposit_id: string
          failure_code?: string | null
          id?: string
          order_id: string
          raw?: Json | null
          status: string
        }
        Update: {
          amount_rwf?: number | null
          created_at?: string
          currency?: string | null
          deposit_id?: string
          failure_code?: string | null
          id?: string
          order_id?: string
          raw?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          }
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          is_primary: boolean
          product_id: string
          sort_order: number
          url: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id: string
          sort_order?: number
          url: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string
          compare_at_price_rwf: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          low_stock_threshold: number
          name: string
          price_rwf: number
          product_type: string
          slug: string
          spec_1: string | null
          spec_2: string | null
          stock: number
          weight_grams: number | null
        }
        Insert: {
          active?: boolean
          category: string
          compare_at_price_rwf?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          low_stock_threshold?: number
          name: string
          price_rwf: number
          product_type?: string
          slug: string
          spec_1?: string | null
          spec_2?: string | null
          stock?: number
          weight_grams?: number | null
        }
        Update: {
          active?: boolean
          category?: string
          compare_at_price_rwf?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          low_stock_threshold?: number
          name?: string
          price_rwf?: number
          product_type?: string
          slug?: string
          spec_1?: string | null
          spec_2?: string | null
          stock?: number
          weight_grams?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          billing_address: string | null
          billing_code: string | null
          created_at: string
          currency_preference: string
          display_name: string | null
          email: string | null
          first_name: string | null
          id: string
          language_preference: string
          last_name: string | null
          location_address: string | null
          location_city: string | null
          location_country: string | null
          phone: string | null
          phone_country_code: string | null
          theme_preference: string
        }
        Insert: {
          avatar_url?: string | null
          billing_address?: string | null
          billing_code?: string | null
          created_at?: string
          currency_preference?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          language_preference?: string
          last_name?: string | null
          location_address?: string | null
          location_city?: string | null
          location_country?: string | null
          phone?: string | null
          phone_country_code?: string | null
          theme_preference?: string
        }
        Update: {
          avatar_url?: string | null
          billing_address?: string | null
          billing_code?: string | null
          created_at?: string
          currency_preference?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          language_preference?: string
          last_name?: string | null
          location_address?: string | null
          location_city?: string | null
          location_country?: string | null
          phone?: string | null
          phone_country_code?: string | null
          theme_preference?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount_rwf: number
          created_at: string
          created_by: string | null
          deposit_id: string
          failure_code: string | null
          id: string
          order_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_rwf: number
          created_at?: string
          created_by?: string | null
          deposit_id: string
          failure_code?: string | null
          id: string
          order_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_rwf?: number
          created_at?: string
          created_by?: string | null
          deposit_id?: string
          failure_code?: string | null
          id?: string
          order_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          }
        ]
      }
      review_votes: {
        Row: {
          created_at: string
          id: string
          review_id: string
          user_id: string
          vote_type: number
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          user_id: string
          vote_type: number
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
          vote_type?: number
        }
        Relationships: [
          {
            foreignKeyName: "review_votes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          downvotes: number
          id: string
          link_url: string | null
          photo_url: string | null
          product_id: string
          rating: number
          updated_at: string
          upvotes: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          downvotes?: number
          id?: string
          link_url?: string | null
          photo_url?: string | null
          product_id: string
          rating: number
          updated_at?: string
          upvotes?: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          downvotes?: number
          id?: string
          link_url?: string | null
          photo_url?: string | null
          product_id?: string
          rating?: number
          updated_at?: string
          upvotes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      stock_movements: {
        Row: {
          change: number
          created_at: string
          created_by: string | null
          id: string
          order_id: string | null
          product_id: string
          reason: string
          stock_after: number
        }
        Insert: {
          change: number
          created_at?: string
          created_by?: string | null
          id?: string
          order_id?: string | null
          product_id: string
          reason: string
          stock_after: number
        }
        Update: {
          change?: number
          created_at?: string
          created_by?: string | null
          id?: string
          order_id?: string | null
          product_id?: string
          reason?: string
          stock_after?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      admin_archive_order: {
        Args: {
          _archive: boolean
          _order_id: string
        }
        Returns: undefined
      }
      admin_cancel_order: {
        Args: {
          _order_id: string
          _reason: string
        }
        Returns: {
            refund_deposit_id: string
            refund_amount_rwf: number
          }[]
      }
      admin_chat_threads: { Args: never; Returns: {
            user_id: string
            display_name: string
            email: string
            avatar_url: string
            last_message: string
            last_at: string
            needs_reply: boolean
            total: number
          }[] }
      analytics_overview: {
        Args: {
          _days?: number
        }
        Returns: Json
      }
      apply_payment_result: {
        Args: {
          _amount: number
          _currency: string
          _deposit_id: string
          _failure_code: string
          _raw: Json
          _status: string
        }
        Returns: string
      }
      apply_refund_result: {
        Args: {
          _failure_code: string
          _raw: Json
          _refund_id: string
          _status: string
        }
        Returns: string
      }
      cancel_my_unpaid_order: {
        Args: {
          _order_id: string
        }
        Returns: undefined
      }
      create_checkout_order: {
        Args: {
          _anonymous: boolean
          _customer: Json
          _display_currency: string
          _items: Json
          _payment_method: string
          _pickup: boolean
          _user_id: string
        }
        Returns: {
            order_id: string
            order_code: string
            total_rwf: number
            expires_at: string
          }[]
      }
      gen_order_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hide_my_order: {
        Args: {
          _order_id: string
        }
        Returns: undefined
      }
      notify_admins: {
        Args: {
          _body: string
          _kind: string
          _link: string
          _severity: string
          _title: string
        }
        Returns: undefined
      }
      notify_user: {
        Args: {
          _body: string
          _kind: string
          _link: string
          _severity: string
          _title: string
          _user: string
        }
        Returns: undefined
      }
      release_expired_reservations: { Args: never; Returns: number }
      release_order_stock: {
        Args: {
          _order_id: string
        }
        Returns: undefined
      }
      reserve_order_stock: {
        Args: {
          _order_id: string
        }
        Returns: undefined
      }
      shipping_fee_rwf: {
        Args: {
          _city: string
          _pickup: boolean
          _subtotal: number
        }
        Returns: number
      }
      start_payment: {
        Args: {
          _deposit_id: string
          _order_id: string
          _phone: string
          _provider: string
          _user_id: string
        }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
