'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ImageUpload } from '@/components/admin/image-upload';
import { useAuth } from '@/components/auth/auth-provider';

export function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      console.log('No user found, redirecting to login');
      router.push('/login');
      return;
    }

    console.log('Current user:', user);
    console.log('User role:', user.role);

    if (user.role !== 'admin') {
      console.log('User is not admin, redirecting to home');
      router.push('/');
      return;
    }

    console.log('Admin access granted');
  }, [user, router]);

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
      <ImageUpload />
    </div>
  );
}