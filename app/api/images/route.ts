import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const offset = (page - 1) * limit;

    const supabase = createRouteHandlerClient({ cookies });
    
    const { data: images, error, count } = await supabase
      .from('images')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!images) {
      return NextResponse.json({ images: [], total: 0, hasMore: false });
    }

    return NextResponse.json({
      images,
      total: count || 0,
      hasMore: count ? count > offset + limit : false
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // セッションチェック
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    // セッション取得後にログを出力
    console.log('Session:', session);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;

    // ファイル名にユニークIDを付与
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    
    // ストレージにアップロード
    const { data: storageData, error: storageError } = await supabase.storage
      .from('images')
      .upload(`public/${fileName}`, file);

    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 500 });
    }

    // データベースレコードの作成
    const { data: image, error: dbError } = await supabase
      .from('images')
      .insert([
        {
          user_id: session.user.id,
          title,
          description,
          storage_path: storageData.path,
          url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/${storageData.path}`
        }
      ])
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError); // 
      // エラー時はアップロードしたファイルも削除
      await supabase.storage
        .from('images')
        .remove([storageData.path]);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json(image);
  } catch (error) {
    console.error('Server error:', error); 
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}