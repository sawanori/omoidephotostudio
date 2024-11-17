// 共通の型定義
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
  user_metadata?: {
    [key: string]: any;
  };
}

export interface Image {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  url: string;
  storage_path: string;
  created_at: string;
  updated_at: string;
}

export interface Like {
  id: string;
  user_id: string;
  image_id: string;
  created_at: string;
}

export interface AuthError extends Error {
  status?: number;
  code?: string;
}

export type SignupResponse = {
  user: User | null;
  error: AuthError | null;
  needsEmailConfirmation?: boolean;
};

// FileOptionsの拡張型を定義
interface ExtendedFileOptions extends FileOptions {
  onUploadProgress?: (progress: { loaded: number; total?: number }) => void;
}