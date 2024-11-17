'use client';

import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { ImageCard } from '@/components/image-card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/components/auth/auth-provider';
import { useDownload } from '@/hooks/use-download';
import { Image as ImageType } from '@/lib/supabase/types';
import Masonry from 'react-masonry-css';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { UserLikedImage } from '@/lib/supabase/types';
import { useLikeStore } from '@/lib/store/like-store';

const breakpointColumns = {
  default: 4,
  1536: 4,
  1280: 3,
  1024: 3,
  768: 2,
  640: 2,
};

export function LikedImages() {
  const { user } = useAuth();
  const { downloadImages, isDownloading, progress } = useDownload();
  const [likedImages, setLikedImages] = useState<UserLikedImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[LikedImages] Setting up realtime subscription');

    const fetchLikedImages = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const supabase = createClientComponentClient();
        const { data, error } = await supabase
          .from('user_liked_images')
          .select('*')
          .eq('user_id', user.id);

        if (error) {
          throw error;
        }

        console.log('[LikedImages] Fetched images:', data);
        setLikedImages(data);
        setError(null);
      } catch (err) {
        console.error('[LikedImages] Error fetching images:', err);
        setError('Failed to load liked images. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLikedImages();

    const supabase = createClientComponentClient();
    const channel = supabase
      .channel('public:likes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'likes',
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          console.log('[LikedImages] Received realtime event:', {
            type: payload.eventType,
            old_record: payload.old_record,
            new_record: payload.new_record
          });
          fetchLikedImages();
        }
      )
      .subscribe((status) => {
        console.log('[LikedImages] Subscription status:', status);
      });

    return () => {
      console.log('[LikedImages] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Please log in to see your liked images.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        {error}
        <button 
          onClick={() => {
            setIsLoading(true);
            setError(null);
            // Refetch liked images
          }}
          className="ml-2 text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (likedImages.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">You haven't liked any images yet.</p>
      </div>
    );
  }

  const handleUnlike = async (imageId: string) => {
    if (!user) return;

    try {
      const supabase = createClientComponentClient();
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('image_id', imageId);

      if (error) throw error;

      // UIの即時更新
      setLikedImages(prevImages => 
        prevImages.filter(image => image.image_id !== imageId)
      );

      // グローバル状態を更新
      await useLikeStore.getState().updateLikedCount(user.id);

    } catch (error) {
      console.error('[LikedImages] Error in unlike operation:', error);
    }
  };

  const handleDownloadAll = async () => {
    if (!user || likedImages.length === 0) return;

    try {
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
    } catch (error) {
      console.error('[LikedImages] Error downloading images:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <Button
          onClick={handleDownloadAll}
          disabled={isDownloading}
          className="gap-2 w-full sm:w-auto sm:self-end"
        >
          {isDownloading ? (
            <>
              <LoadingSpinner className="h-4 w-4" />
              ダウンロード中...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              全ダウンロード
            </>
          )}
        </Button>
        {isDownloading && (
          <div className="w-full space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-center text-muted-foreground">
            ダウンロード中 {Math.round(progress)}%
            </p>
          </div>
        )}
      </div>

      <Masonry
        breakpointCols={breakpointColumns}
        className="flex -ml-2 sm:-ml-4 w-auto"
        columnClassName="pl-2 sm:pl-4 bg-background"
      >
        {likedImages.map((image) => (
          <div key={image.image_id} className="mb-2 sm:mb-4">
            <ImageCard 
              image={{
                id: image.image_id,
                title: image.title,
                description: image.description,
                url: image.url,
                storage_path: image.storage_path,
                created_at: image.created_at,
                updated_at: image.updated_at
              }}
              onUnlike={handleUnlike}
            />
          </div>
        ))}
      </Masonry>
    </div>
  );
}