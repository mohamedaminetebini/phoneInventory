import type { Currency, Direction } from "../../domain/transactions";

export type PhoneTransactionRow = {
  id: string;
  user_id: string;
  direction: Direction;
  sold_from_transaction_id: string | null;
  model_id: string;
  phone_model: string;
  phone_color: string;
  imei: string | null;
  serial_number: string | null;
  amount: number;
  currency: Currency;
  date: string;
  phone_photos: string[];
  id_front_path: string | null;
  id_back_path: string | null;
  notes: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      phone_transactions: {
        Row: PhoneTransactionRow;
        Insert: Omit<PhoneTransactionRow, "created_at"> & { created_at?: string };
        Update: Partial<Omit<PhoneTransactionRow, "id" | "user_id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
