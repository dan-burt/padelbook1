export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      booking_players: {
        Row: {
          amount_due: number
          booking_id: string | null
          created_at: string | null
          has_paid: boolean | null
          id: string
          player_id: string | null
        }
        Insert: {
          amount_due: number
          booking_id?: string | null
          created_at?: string | null
          has_paid?: boolean | null
          id?: string
          player_id?: string | null
        }
        Update: {
          amount_due?: number
          booking_id?: string | null
          created_at?: string | null
          has_paid?: boolean | null
          id?: string
          player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_players_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          }
        ]
      }
      bookings: {
        Row: {
          booking_date: string
          created_at: string | null
          duration_hours: number
          id: string
          number_of_courts: number
          start_time: string
          total_price: number
        }
        Insert: {
          booking_date: string
          created_at?: string | null
          duration_hours: number
          id?: string
          number_of_courts: number
          start_time: string
          total_price: number
        }
        Update: {
          booking_date?: string
          created_at?: string | null
          duration_hours?: number
          id?: string
          number_of_courts?: number
          start_time?: string
          total_price?: number
        }
        Relationships: []
      }
      courts: {
        Row: {
          created_at: string | null
          hourly_rate: number
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          hourly_rate: number
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          hourly_rate?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
} 