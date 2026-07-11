export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_by: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_by: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_by?: string;
        };
        Relationships: [];
      };
      boards: {
        Row: {
          id: string;
          project_id: string | null;
          name: string;
          description: string | null;
          created_by: string;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          name: string;
          description?: string | null;
          created_by: string;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          name?: string;
          description?: string | null;
          created_by?: string;
        };
        Relationships: [];
      };
      board_members: {
        Row: {
          id: string;
          board_id: string;
          user_id: string;
          role: "View Only" | "Update Progress" | "Add/Delete Task" | "Owner";
          status: "Pending" | "Accepted";
        };
        Insert: {
          id?: string;
          board_id: string;
          user_id: string;
          role: "View Only" | "Update Progress" | "Add/Delete Task" | "Owner";
          status?: "Pending" | "Accepted";
        };
        Update: {
          id?: string;
          board_id?: string;
          user_id?: string;
          role?: "View Only" | "Update Progress" | "Add/Delete Task" | "Owner";
          status?: "Pending" | "Accepted";
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          board_id: string;
          created_by: string;
          name: string;
          description: string | null;
          status: "todo" | "inprogress" | "done";
          due_date: string | null;
          assigned_to: string | null;
        };
        Insert: {
          id?: string;
          board_id: string;
          created_by: string;
          name: string;
          description?: string | null;
          status?: "todo" | "inprogress" | "done";
          due_date?: string | null;
          assigned_to?: string | null;
        };
        Update: {
          id?: string;
          board_id?: string;
          created_by?: string;
          name?: string;
          description?: string | null;
          status?: "todo" | "inprogress" | "done";
          due_date?: string | null;
          assigned_to?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: string;
          related_id: string | null;
          is_read: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message: string;
          type: string;
          related_id?: string | null;
          is_read?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          message?: string;
          type?: string;
          related_id?: string | null;
          is_read?: boolean;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Inserts<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type Updates<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
