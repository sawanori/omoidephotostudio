import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  try {
    const res = NextResponse.next();



        // CSPヘッダーを追加
        res.headers.set(
          'Content-Security-Policy',
          `
            default-src 'self';
            script-src 'self' 'unsafe-inline' 'unsafe-eval';
            style-src 'self' 'unsafe-inline';
            img-src 'self' blob: data: https://*.supabase.co https://*.supabase.in;
            font-src 'self';
            connect-src 'self' 
              https://*.supabase.co 
              https://*.supabase.in 
              wss://*.supabase.co;
            frame-ancestors 'none';
            base-uri 'self';
            form-action 'self';
          `.replace(/\s+/g, ' ').trim()
        );
    
    const supabase = createMiddlewareClient({ req: request, res });
    // セッションの更新
    await supabase.auth.getSession();

    return res;
  } catch (error) {
    console.error('Middleware error:', error);
    // エラーが発生した場合でもリクエストを続行
    return NextResponse.next();
  }
}

// 特定のパスのみにミドルウェアを適用
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};