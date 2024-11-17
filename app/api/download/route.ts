import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import sharp from 'sharp';

export async function POST(request: Request) {
  try {
    const { imageIds } = await request.json();
    const supabase = createRouteHandlerClient({ cookies });

    const { data: images, error } = await supabase
      .from('images')
      .select('*')
      .in('id', imageIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Process and optimize images
    const processedImages = await Promise.all(
      images.map(async (image) => {
        const response = await fetch(image.url);
        const buffer = await response.arrayBuffer();
        
        const optimized = await sharp(buffer)
          .resize(1200, null, { withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();

        return {
          ...image,
          optimizedBuffer: optimized
        };
      })
    );

    return NextResponse.json({ images: processedImages });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}