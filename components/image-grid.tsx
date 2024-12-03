'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Masonry from 'react-masonry-css';
import Image from 'next/image';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { Card } from '@/components/ui/card';
import { Heart, Loader2, AlertCircle } from 'lucide-react';
import { ImageModal } from '@/components/image-modal';
import { Image as ImageType } from '@/lib/supabase/types';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { useLikeStore } from '@/lib/store/like-store';
import { Alert, AlertDescription } from '@/components/ui/alert';

const LOAD_MORE_COUNT = 12;
const RETRY_DELAY = 1000;
const MAX_RETRIES = 3;

// URLキャッシュ
const urlCache = new Map<string, { url: string; expires: number }>();

// アスペクト比の設定を調整する関数
const getRandomAspectRatio = (size: 'normal' | 'large') => {
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
};

// 署名付きURLを取得する関数（キャッシュとリトライ機能付き）
const getSignedUrl = async (
  supabase: any,
  storagePath: string,
  retryCount = 0
): Promise<string | null> => {
  // キャッシュをチェック
  const cached = urlCache.get(storagePath);
  if (cached && cached.expires > Date.now()) {
    return cached.url;
  }

  try {
    const { data, error } = await supabase
      .storage
      .from('photo-gallery-images')
      .createSignedUrl(storagePath, 3600);

    if (error) {
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying signed URL generation for ${storagePath} (attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return getSignedUrl(supabase, storagePath, retryCount + 1);
      }
      throw error;
    }

    if (data?.signedUrl) {
      // キャッシュに保存（1時間 - 5分の有効期限）
      urlCache.set(storagePath, {
        url: data.signedUrl,
        expires: Date.now() + (3600 - 300) * 1000
      });
      return data.signedUrl;
    }
  } catch (error) {
    console.error('Error getting signed URL:', error);
    if (retryCount < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
      return getSignedUrl(supabase, storagePath, retryCount + 1);
    }
  }
  return null;
};

export function ImageGrid() {
  const [images, setImages] = useState<ImageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [retryCount, setRetryCount] = useState(0);
  const processingRef = useRef(false);

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '100px',
  });
  
  const supabase = createClientComponentClient();
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(-1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const [likedImages, setLikedImages] = useState<Set<string>>(new Set());
  const [loadingLikes, setLoadingLikes] = useState<Set<string>>(new Set());

  // いいね状態を取得する関数
  const fetchLikeStatus = useCallback(async () => {
    if (!user || images.length === 0) return;

    try {
      const imageIds = images.map(img => img.id);
      const response = await fetch('/api/likes/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageIds }),
      });

      if (!response.ok) throw new Error('Network response was not ok');
      
      const data = await response.json();
      setLikedImages(new Set(data.likedImageIds));
    } catch (error) {
      console.error('Error fetching like status:', error);
    }
  }, [user, images]);

  // リアルタイム更新のセットアップ
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('likes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'likes',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setLikedImages(prev => new Set([...Array.from(prev), payload.new.image_id]));
          } else if (payload.eventType === 'DELETE') {
            setLikedImages(prev => {
              const newSet = new Set(prev);
              newSet.delete(payload.old.image_id);
              return newSet;
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  // いいね状態の取得タイミングを調整
  useEffect(() => {
    if (user && !loading) {
      fetchLikeStatus();
    }
  }, [user, loading, fetchLikeStatus]);

  // 画像データの取得を最適化
  const fetchImages = useCallback(async (pageNum: number) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      }
      
      console.log('画像取得開始:', pageNum);
      
      // 1. まずデータが存在するか確認
      const { count } = await supabase
      
        .from('images')
        .select('*', { count: 'exact', head: true });
        
      console.log('総画像数:', count);

      if (count === 0) {
        console.log('画像が存在しません');
        setLoading(false);
        setHasMore(false);
        return;
      }

      // 2. 画像データの取得
      const { data: images, error: fetchError } = await supabase
        .from('images')
        .select('*')
        .order('created_at', { ascending: false })
        .range((pageNum - 1) * LOAD_MORE_COUNT, pageNum * LOAD_MORE_COUNT - 1);

      if (fetchError) {
        console.error('データ取得エラー:', fetchError);
        throw fetchError;
      }

      console.log('取得した画像:', images);

      // 3. 署名付きURLの生成
      const processedImages = await Promise.all(
        images.map(async (image) => {
          try {
            const { data: urlData, error: urlError } = await supabase
              .storage
              .from('photo-gallery-images')
              .createSignedUrl(image.storage_path, 3600);

            if (urlError) {
              console.error('URL生成エラー:', urlError);
              return null;
            }

            return {
              ...image,
              url: urlData.signedUrl,
              aspectRatio: getRandomAspectRatio('normal')
            };
          } catch (error) {
            console.error('画像処理エラー:', error);
            return null;
          }
        })
      );

      const validImages = processedImages.filter(img => img !== null);
      
      if (validImages.length === 0) {
        setError('画像の読み込みに失敗しました');
        setLoading(false);
        return;
      }

      setImages(prev => pageNum === 1 ? validImages : [...prev, ...validImages]);
      setHasMore(validImages.length === LOAD_MORE_COUNT);
      setLoading(false);

    } catch (error) {
      console.error('fetchImages エラー:', error);
      setError('画像の読み込みに失敗しました');
      setLoading(false);
    }
  }, [supabase]);

  // 画像の読み込み完了を追跡する関数
  const handleImageLoad = useCallback((imageId: string) => {
    console.log('画像読み込み完了:', imageId);
    setLoadedImages(prev => {
      const newSet = new Set(prev);
      newSet.add(imageId);
      return newSet;
    });
  }, []);

  // 画像の読み込みエラーを処理する関数
  const handleImageError = useCallback((imageId: string) => {
    console.error('画像読み込みエラー:', imageId);
    setFailedImages(prev => new Set(prev).add(imageId));
  }, []);

  // 初回読み込み
  useEffect(() => {
    console.log('Initial fetch triggered');
    fetchImages(1);
  }, [fetchImages]);

  // 無限スクロール
  useEffect(() => {
    if (inView && !loading && hasMore && !error) {
      console.log('Loading more images', { page: page + 1 });
      setPage(prev => prev + 1);
      fetchImages(page + 1);
    }
  }, [inView, loading, hasMore, fetchImages, page, error]);

  const handleLike = async (imageId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (!user) {
      toast({
        title: 'ログインが必要です',
        description: 'いいねするにはログインしてください',
        variant: 'destructive',
      });
      return;
    }

    setLoadingLikes(prev => new Set(prev).add(imageId));
    
    try {
      const isLiked = likedImages.has(imageId);
      const response = await fetch('/api/likes', {
        method: isLiked ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_id: imageId }),
      });

      if (!response.ok) throw new Error('Failed to update like status');

      setLikedImages(prev => {
        const newLikes = new Set(prev);
        if (isLiked) {
          newLikes.delete(imageId);
          useLikeStore.getState().decrementLikedCount();
        } else {
          newLikes.add(imageId);
          useLikeStore.getState().incrementLikedCount();
        }
        return newLikes;
      });
    } catch (error) {
      console.error('Like error:', error);
      toast({
        title: 'エラー',
        description: 'いいねの更新に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setLoadingLikes(prev => {
        const newLoading = new Set(prev);
        newLoading.delete(imageId);
        return newLoading;
      });
    }
  };

  const breakpointColumns = {
    default: 4,
    1536: 4,
    1280: 3,
    1024: 3,
    768: 2,
    640: 2
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {loading && page === 1 ? (
          <div className="flex justify-center items-center min-h-[200px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <Masonry
              breakpointCols={breakpointColumns}
              className="flex -ml-4 w-auto"
              columnClassName="pl-4 bg-clip-padding"
            >
              {images.map((image) => (
                <div 
                  key={`${image.id}-${image.url}`} 
                  className="mb-4 cursor-pointer"
                  onClick={() => {
                    setSelectedImageIndex(images.findIndex(img => img.id === image.id));
                    setIsModalOpen(true);
                  }}
                >
                  <Card className="overflow-hidden group hover:shadow-lg transition-shadow duration-200">
                    <div className="relative">
                      <div className={`${image.aspectRatio} relative overflow-hidden`}>
                        {failedImages.has(image.id) ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100">
                            <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
                            <p className="text-sm text-gray-500 mb-2">画像の読み込みに失敗しました</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleImageError(image.id);
                              }}
                            >
                              再読み込み
                            </Button>
                          </div>
                        ) : (
                          <Image
                            src={image.url}
                            alt={image.title}
                            fill
                            quality={60}
                            className="object-cover transition-transform duration-200 group-hover:scale-105"
                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            onLoad={() => handleImageLoad(image.id)}
                            onError={() => handleImageError(image.id)}
                          />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors">
                          <button
                            onClick={(e) => handleLike(image.id, e)}
                            className="absolute top-2 right-2 p-2 bg-black/50 rounded-full transition-opacity"
                            disabled={loadingLikes.has(image.id)}
                          >
                            {loadingLikes.has(image.id) ? (
                              <span className="animate-pulse">...</span>
                            ) : likedImages.has(image.id) ? (
                              <Heart className="h-5 w-5 text-red-500 fill-current" />
                            ) : (
                              <Heart className="h-5 w-5 text-white" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              ))}
            </Masonry>
            {hasMore && !error && (
              <div ref={loadMoreRef} className="flex justify-center mt-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}
          </>
        )}
      </div>

      {isModalOpen && selectedImageIndex >= 0 && (
        <ImageModal
          images={images}
          initialIndex={selectedImageIndex}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedImageIndex(-1);
          }}
        />
      )}
    </>
  );
}