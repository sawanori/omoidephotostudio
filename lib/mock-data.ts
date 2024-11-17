import { User, Image, UserRole } from '@/lib/types';

export interface MockUser extends User {
  password: string;
}

export const mockUsers: MockUser[] = [
  {
    id: 'admin-1',
    email: 'admin@example.com',
    password: 'admin123',
    role: 'admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'user-1',
    email: 'demo@example.com',
    password: 'password123',
    role: 'user',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const mockImages: Image[] = [
  {
    id: 'img-1',
    user_id: 'admin-1',
    title: 'Mountain View',
    description: null,
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=800&q=80',
    storage_path: '/images/1.jpg',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // ... 他の画像データ
];

export const mockLikes = new Map<string, Set<string>>();

// 初期データの設定
mockLikes.set('user-1', new Set(['img-1', 'img-2']));
mockLikes.set('admin-1', new Set(['img-1']));