// Database types for the DoloGram Supabase project (D-56).
//
// PROVENANCE: transcription of the binding contract in v14 6.2 and M1-01 (column names, uuid ids,
// timestamptz timestamps, bigint counters, smallint attachment_count, text[] premium_flags). It is
// written in the shape `supabase gen types typescript` emits so that `npm run gen:types` can replace
// this file unchanged once M1-01 to M1-06 are applied to the hosted project.
//
// Pending: the hosted project has no public tables yet (every REST probe returns PGRST205), so the
// generator cannot run (plan Phase 1 step 1, blocker recorded in docs/test-results/android/phase-01.md).
// Columns written by triggers or inside the database (chat_id/storage_path/sync_seq on message_media
// and reactions) are optional on Insert, matching the client-writable column set of 10.5.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      chat_members: {
        Row: {
          archived: boolean;
          chat_id: string;
          joined_at: string;
          last_read_seq: number;
          muted_until: string | null;
          nickname?: string | null;
          role: string;
          user_id: string;
        };
        Insert: {
          archived?: boolean;
          chat_id: string;
          joined_at?: string;
          last_read_seq?: number;
          muted_until?: string | null;
          nickname?: string | null;
          role?: string;
          user_id: string;
        };
        Update: {
          archived?: boolean;
          chat_id?: string;
          joined_at?: string;
          last_read_seq?: number;
          muted_until?: string | null;
          nickname?: string | null;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_members_chat_id_fkey';
            columns: ['chat_id'];
            isOneToOne: false;
            referencedRelation: 'chats';
            referencedColumns: ['chat_id'];
          },
          {
            foreignKeyName: 'chat_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      chats: {
        Row: {
          avatar_url?: string | null;
          chat_id: string;
          created_at: string;
          created_by: string;
          direct_key: string | null;
          next_seq: number;
          title: string | null;
          type: string;
        };
        Insert: {
          avatar_url?: string | null;
          chat_id: string;
          created_at?: string;
          created_by: string;
          direct_key?: string | null;
          next_seq?: number;
          title?: string | null;
          type: string;
        };
        Update: {
          avatar_url?: string | null;
          chat_id?: string;
          created_at?: string;
          created_by?: string;
          direct_key?: string | null;
          next_seq?: number;
          title?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chats_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      folder_chats: {
        Row: {
          chat_id: string;
          folder_id: string;
        };
        Insert: {
          chat_id: string;
          folder_id: string;
        };
        Update: {
          chat_id?: string;
          folder_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'folder_chats_chat_id_fkey';
            columns: ['chat_id'];
            isOneToOne: false;
            referencedRelation: 'chats';
            referencedColumns: ['chat_id'];
          },
          {
            foreignKeyName: 'folder_chats_folder_id_fkey';
            columns: ['folder_id'];
            isOneToOne: false;
            referencedRelation: 'folders';
            referencedColumns: ['folder_id'];
          },
        ];
      };
      folders: {
        Row: {
          folder_id: string;
          name: string;
          user_id: string;
        };
        Insert: {
          folder_id: string;
          name: string;
          user_id: string;
        };
        Update: {
          folder_id?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'folders_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      message_media: {
        Row: {
          chat_id: string;
          compressed: boolean;
          deleted_at: string | null;
          media_id: string;
          media_type: string;
          message_id: string;
          storage_path: string;
          sync_seq: number;
        };
        Insert: {
          chat_id?: string;
          compressed?: boolean;
          deleted_at?: string | null;
          media_id: string;
          media_type: string;
          message_id: string;
          storage_path?: string;
          sync_seq?: number;
        };
        Update: {
          chat_id?: string;
          compressed?: boolean;
          deleted_at?: string | null;
          media_id?: string;
          media_type?: string;
          message_id?: string;
          storage_path?: string;
          sync_seq?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'message_media_chat_id_fkey';
            columns: ['chat_id'];
            isOneToOne: false;
            referencedRelation: 'chats';
            referencedColumns: ['chat_id'];
          },
          {
            foreignKeyName: 'message_media_message_id_fkey';
            columns: ['message_id'];
            isOneToOne: false;
            referencedRelation: 'messages';
            referencedColumns: ['message_id'];
          },
        ];
      };
      messages: {
        Row: {
          attachment_count: number;
          chat_id: string;
          content: string;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          message_id: string;
          reply_to: string | null;
          sender_id: string;
          seq: number;
          sync_seq: number;
        };
        Insert: {
          attachment_count?: number;
          chat_id: string;
          content?: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          message_id: string;
          reply_to?: string | null;
          sender_id: string;
          seq?: number;
          sync_seq?: number;
        };
        Update: {
          attachment_count?: number;
          chat_id?: string;
          content?: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          message_id?: string;
          reply_to?: string | null;
          sender_id?: string;
          seq?: number;
          sync_seq?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_chat_id_fkey';
            columns: ['chat_id'];
            isOneToOne: false;
            referencedRelation: 'chats';
            referencedColumns: ['chat_id'];
          },
          {
            foreignKeyName: 'messages_reply_to_fkey';
            columns: ['reply_to'];
            isOneToOne: false;
            referencedRelation: 'messages';
            referencedColumns: ['message_id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          display_name: string;
          premium_flags: string[] | null;
          user_id: string;
          username: string;
        };
        Insert: {
          avatar_url?: string | null;
          display_name: string;
          premium_flags?: string[] | null;
          user_id: string;
          username: string;
        };
        Update: {
          avatar_url?: string | null;
          display_name?: string;
          premium_flags?: string[] | null;
          user_id?: string;
          username?: string;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          android_channel_id: string | null;
          badges: boolean;
          created_at: string;
          last_seen_at: string;
          message_previews: boolean;
          platform: string;
          preview_text: boolean;
          sounds: boolean;
          token: string;
          user_id: string;
          vibration: boolean;
        };
        Insert: {
          android_channel_id?: string | null;
          badges?: boolean;
          created_at?: string;
          last_seen_at?: string;
          message_previews?: boolean;
          platform?: string;
          preview_text?: boolean;
          sounds?: boolean;
          token: string;
          user_id: string;
          vibration?: boolean;
        };
        Update: {
          android_channel_id?: string | null;
          badges?: boolean;
          created_at?: string;
          last_seen_at?: string;
          message_previews?: boolean;
          platform?: string;
          preview_text?: boolean;
          sounds?: boolean;
          token?: string;
          user_id?: string;
          vibration?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'push_tokens_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      reactions: {
        Row: {
          chat_id: string;
          emoji: string;
          message_id: string;
          removed_at: string | null;
          sync_seq: number;
          user_id: string;
        };
        Insert: {
          chat_id?: string;
          emoji: string;
          message_id: string;
          removed_at?: string | null;
          sync_seq?: number;
          user_id: string;
        };
        Update: {
          chat_id?: string;
          emoji?: string;
          message_id?: string;
          removed_at?: string | null;
          sync_seq?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reactions_chat_id_fkey';
            columns: ['chat_id'];
            isOneToOne: false;
            referencedRelation: 'chats';
            referencedColumns: ['chat_id'];
          },
          {
            foreignKeyName: 'reactions_message_id_fkey';
            columns: ['message_id'];
            isOneToOne: false;
            referencedRelation: 'messages';
            referencedColumns: ['message_id'];
          },
          {
            foreignKeyName: 'reactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      delete_chat_attachment: {
        Args: { p_media_id: string };
        Returns: Database['public']['Tables']['message_media']['Row'];
      };
      push_unread_counts: {
        Args: { recipient_ids: string[] };
        Returns: { user_id: string; unread_count: number }[];
      };
      find_user: {
        Args: { username: string };
        Returns: { display_name: string; user_id: string }[];
      };
      set_chat_nickname: {
        Args: { p_chat_id: string; p_nickname: string | null; p_user_id: string };
        Returns: Database['public']['Tables']['chat_members']['Row'][];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
