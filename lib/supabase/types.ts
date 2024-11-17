export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
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

export interface Image {
  id: string;
  title: string;
  description?: string;
  url: string;
  created_at: string;
  user_id?: string;
}

export interface Like {
  id: string;
  user_id: string;
  image_id: string;
  created_at: string;
}

export interface Session {
  email: string;
}

export type UserLikedImage = {
  user_id: string;
  image_id: string;
  title: string;
  description: string;
  url: string;
  storage_path: string;
  created_at: string;
  updated_at: string;
};