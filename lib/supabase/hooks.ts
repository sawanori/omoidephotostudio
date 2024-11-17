'use client';

import { useState, useEffect } from 'react';
import { mockLikes, mockImages } from '@/lib/mock-data';
import { useAuth } from '@/components/auth/auth-provider';
import { Image as ImageType } from '@/lib/supabase/types';

export function useLikes(imageId: string) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setIsLiked(false);
      setLikeCount(0);
      return;
    }

    const userLikes = mockLikes.get(user.id) || new Set();
    setIsLiked(userLikes.has(imageId));

    // いいね数を計算
    let count = 0;
    mockLikes.forEach(likes => {
      if (likes.has(imageId)) count++;
    });
    setLikeCount(count);
  }, [imageId, user]);

  const toggleLike = async () => {
    if (!user) return;

    let userLikes = mockLikes.get(user.id);
    if (!userLikes) {
      userLikes = new Set();
      mockLikes.set(user.id, userLikes);
    }

    const newIsLiked = !isLiked;
    if (newIsLiked) {
      userLikes.add(imageId);
      setLikeCount(prev => prev + 1);
    } else {
      userLikes.delete(imageId);
      setLikeCount(prev => prev - 1);
    }

    setIsLiked(newIsLiked);
  };

  return { isLiked, likeCount, toggleLike };
}