import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { imageIds } = await request.json();

    // セッションの確認
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // いいね状態を一括取得
    const { data: likes, error } = await supabase
      .from('likes')
      .select('image_id')
      .eq('user_id', userId)
      .in('image_id', imageIds);

    if (error) {
      console.error('Error fetching likes:', error);
      return NextResponse.json({ error: 'Failed to fetch likes' }, { status: 500 });
    }

    // いいねされている画像IDのリストを返す
    const likedImageIds = likes.map(like => like.image_id);
    return NextResponse.json({ likedImageIds });

  } catch (error) {
    console.error('Error in batch likes endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 