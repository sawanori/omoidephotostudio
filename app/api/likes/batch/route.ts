import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1秒

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchLikesWithRetry(supabase: any, userId: string, imageIds: string[], retryCount = 0): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('likes')
      .select('image_id')
      .eq('user_id', userId)
      .in('image_id', imageIds)
      .timeout(5000); // 5秒でタイムアウト

    if (error) {
      if (retryCount < MAX_RETRIES && error.message.includes('timeout')) {
        console.log(`Retry attempt ${retryCount + 1} of ${MAX_RETRIES}`);
        await wait(RETRY_DELAY * (retryCount + 1)); // 指数バックオフ
        return fetchLikesWithRetry(supabase, userId, imageIds, retryCount + 1);
      }
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.log(`Retry attempt ${retryCount + 1} of ${MAX_RETRIES}`);
      await wait(RETRY_DELAY * (retryCount + 1));
      return fetchLikesWithRetry(supabase, userId, imageIds, retryCount + 1);
    }
    return { data: null, error };
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // セッションチェック
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ likedImageIds: [] });
    }

    const { imageIds } = await request.json();
    if (!imageIds || !Array.isArray(imageIds)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // バッチサイズを制限（50件ずつ処理）
    const BATCH_SIZE = 50;
    const batches = [];
    for (let i = 0; i < imageIds.length; i += BATCH_SIZE) {
      batches.push(imageIds.slice(i, i + BATCH_SIZE));
    }

    // 各バッチを処理
    const allLikedIds = new Set<string>();
    for (const batch of batches) {
      const { data: likes, error } = await fetchLikesWithRetry(supabase, session.user.id, batch);
      
      if (error) {
        console.error('Database error:', error);
        // エラーが発生しても処理を継続
        continue;
      }

      likes?.forEach((like: { image_id: string }) => {
        allLikedIds.add(like.image_id);
      });
    }

    return NextResponse.json({ likedImageIds: Array.from(allLikedIds) });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 