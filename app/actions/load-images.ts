'use server';

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Image as ImageType } from '@/lib/supabase/types';

const PAGE_SIZE = 12;

export async function loadMoreImages(offset: number = 0, userId?: string) {
  const supabase = createServerComponentClient({ cookies });

  try {
    const { data: images, error } = await supabase
      .from('images')
      .select(`
        *,
        likes!inner(user_id)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    const formattedImages = images.map(image => ({
      ...image,
      isLiked: image.likes.some((like: any) => like.user_id === userId),
      size: Math.random() > 0.2 ? 'normal' : 'large',
      aspectRatio: getRandomAspectRatio(Math.random() > 0.2 ? 'normal' : 'large')
    }));

    const nextOffset = images.length === PAGE_SIZE ? offset + PAGE_SIZE : null;

    return [formattedImages, nextOffset] as const;
  } catch (error) {
    console.error('Error loading images:', error);
    return [[], null] as const;
  }
}

function getRandomAspectRatio(size: 'normal' | 'large') {
  if (size === 'large') {
    const ratios = ['aspect-[16/9]', 'aspect-square'];
    return ratios[Math.floor(Math.random() * ratios.length)];
  }

  const ratios = [
    { class: 'aspect-[3/4]', weight: 2 },
    { class: 'aspect-[4/3]', weight: 1 },
    { class: 'aspect-square', weight: 1 }
  ];

  const weightedRatios = ratios.flatMap(ratio => 
    Array(ratio.weight).fill(ratio.class)
  );

  return weightedRatios[Math.floor(Math.random() * weightedRatios.length)];
}