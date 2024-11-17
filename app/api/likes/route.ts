import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const image_id = searchParams.get('image_id');

    if (!image_id) {
      return NextResponse.json({ error: 'Image ID is required' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ isLiked: false });
    }

    // いいねの状態をチェック
    const { data, error } = await supabase
      .from('likes')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('image_id', image_id)
      .single();

    return NextResponse.json({ isLiked: !!data });
  } catch (error) {
    console.error('Error checking like status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // セッションチェック
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { image_id } = await request.json();
    if (!image_id) {
      return NextResponse.json({ error: 'Image ID is required' }, { status: 400 });
    }

    // 既存のいいねをチェック
    const { data: existingLike } = await supabase
      .from('likes')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('image_id', image_id)
      .single();

    // 既にいいねが存在する場合は成功として扱う
    if (existingLike) {
      return NextResponse.json({ success: true, message: 'Already liked' });
    }

    // いいねを追加
    const { data, error } = await supabase
      .from('likes')
      .insert([{ 
        user_id: session.user.id,
        image_id 
      }])
      .select()
      .single();

    if (error) {
      console.error('Error adding like:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in POST /api/likes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // セッションチェック
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { image_id } = await request.json();
    
    const { error } = await supabase
      .from('likes')
      .delete()
      .match({ 
        user_id: session.user.id,
        image_id 
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}