'use client';

import { useState, useEffect } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/components/auth/auth-provider';
import { useDownload } from '@/hooks/use-download';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useLikeStore } from '@/lib/store/like-store';


export function FloatingDownloadButton() {
  const { user } = useAuth();
  const { downloadImages, isDownloading, progress } = useDownload();
  const { likedCount, updateLikedCount } = useLikeStore();
  const { toast } = useToast();
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (!user) return;

    // 初回カウント取得
    updateLikedCount(user.id);
    
    const channel = supabase
      .channel('public:likes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'likes',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          updateLikedCount(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, updateLikedCount]);

  const handleDownload = async () => {
    if (!user) {
      toast({
        title: 'ログイン必須',
        description: 'ログインお願い致します。',
      });
      return;
    }

    if (likedCount === 0) {
      toast({
        title: 'お選びの写真がありません',
        description: 'まだ写真をお選びいただいておりません',
      });
      return;
    }

    try {
      const { data: likedImages, error } = await supabase
        .from('user_liked_images')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      if (likedImages && likedImages.length > 0) {
        // データ形式を変換
        const images = likedImages.map(image => ({
          id: image.image_id,
          title: image.title,
          url: image.url,
          description: image.description,
          storage_path: image.storage_path,
          created_at: image.created_at,
          updated_at: image.updated_at
        }));
        
        await downloadImages(images);
      }
    } catch (error) {
      console.error('Error fetching liked images:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch liked images',
        variant: 'destructive',
      });
    }
  };

  if (!user) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="flex flex-col items-end gap-2">
        {isDownloading && (
          <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-2 rounded-lg shadow-lg">
            <Progress value={progress} className="w-[200px]" />
            <p className="text-sm text-muted-foreground mt-1">
              ダウンロード中: {Math.round(progress)}%
            </p>
          </div>
        )}
        <div className="relative">
          <Button
            variant="default"
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg"
            onClick={handleDownload}
            disabled={isDownloading || likedCount === 0}
          >
            {isDownloading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Download className="h-6 w-6" />
            )}
          </Button>
          {likedCount > 0 && (
            <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full h-6 w-6 flex items-center justify-center">
              {likedCount}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}