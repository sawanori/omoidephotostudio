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

const INITIAL_LOAD_COUNT = 8;
const LOAD_MORE_COUNT = 6;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2秒

export function ImageGrid() {
  const [images, setImages] = useState<ImageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [retryCount, setRetryCount] = useState(0);
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
  const loadedImagesRef = useRef<Set<string>>(new Set());

  // アスペクト比の設定を調整
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

  // いいね状態を取得する関数を最適化
  const fetchLikeStatus = useCallback(async () => {
    if (!user || images.length === 0) return;

    try {
      // 全ての画像IDを一度に送信
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
      // エラー時は静かに失敗（UIへの影響を最小限に）
    }
  }, [user, images]);

  // リアルタイム更新のセットアップ
  useEffect(() => {
    if (!user) return;

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
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setLikedImages(prev => new Set(Array.from(prev).concat(payload.new.image_id)));
          } else if (payload.eventType === 'DELETE') {
            setLikedImages(prev => {
              const newSet = new Set(prev);
              newSet.delete(payload.old.image_id);
              return newSet;
            });
          }
        }
      )
      .subscribe();

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

  // 画像の読み込み完了を追跡する関数を最適化
  const handleImageLoad = useCallback((imageId: string) => {
    loadedImagesRef.current.add(imageId);
    
    // 最初の数枚が読み込まれたらローディング状態を解除
    if (loadedImagesRef.current.size >= 4 || loadedImagesRef.current.size === images.length) {
      setLoading(false);
    }

    // 読み込みに成功した画像をfailedImagesから削除
    setFailedImages(prev => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      return newSet;
    });
  }, [images.length]);

  // 画像の読み込みエラーを処理する関数を最適化
  const handleImageError = useCallback((imageId: string) => {
    console.error(`Failed to load image: ${imageId}`);
    setFailedImages(prev => new Set(prev).add(imageId));
  }, []);

  // 画像の再読み込みを試みる関数を最適化
  const handleRetryLoad = useCallback(async (imageId: string) => {
    try {
      setFailedImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(imageId);
        return newSet;
      });

      const image = images.find(img => img.id === imageId);
      if (!image?.storage_path) {
        throw new Error('Image storage path not found');
      }

      const { data: imageData, error: imageError } = await supabase
        .storage
        .from('photo-gallery-images')
        .createSignedUrl(image.storage_path, 3600);

      if (imageError) throw imageError;

      setImages(prev => prev.map(img => 
        img.id === imageId 
          ? { ...img, url: imageData.signedUrl }
          : img
      ));

    } catch (error) {
      console.error('Error retrying image load:', error);
      handleImageError(imageId);
    }
  }, [images, supabase, handleImageError]);

  // 全体の再読み込みを試みる関数
  const handleRetryAll = async () => {
    if (retryCount >= MAX_RETRIES) {
      toast({
        title: 'エラー',
        description: '読み込みに失敗しました。時間をおいて再度お試しください。',
        variant: 'destructive',
      });
      return;
    }

    setRetryCount(prev => prev + 1);
    setError(null);
    setLoading(true);
    
    // 少し待ってから再試行
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    await fetchImages(1);
  };

  // 画像データの取得を最適化
  const fetchImages = useCallback(async (pageNum: number) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
        loadedImagesRef.current = new Set();
      }
      
      setError(null);
      const from = (pageNum - 1) * (pageNum === 1 ? INITIAL_LOAD_COUNT : LOAD_MORE_COUNT);
      
      const { count: totalCount } = await supabase
        .from('images')
        .select('*', { count: 'exact', head: true });

      if (totalCount === null || from >= totalCount) {
        setHasMore(false);
        return;
      }

      const to = Math.min(from + (pageNum === 1 ? INITIAL_LOAD_COUNT : LOAD_MORE_COUNT) - 1, totalCount - 1);

      const { data, error: fetchError } = await supabase
        .from('images')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (fetchError) throw fetchError;

      if (data) {
        console.log('Fetched images:', data); // デバッグログ

        const imagesWithSignedUrls = await Promise.all(
          data.map(async (image) => {
            try {
              // storage_pathが存在することを確認
              if (!image.storage_path) {
                console.error('Missing storage_path for image:', image);
                throw new Error('Missing storage_path');
              }

              const { data: signedUrlData, error: signedUrlError } = await supabase
                .storage
                .from('photo-gallery-images')
                .createSignedUrl(image.storage_path, 3600);

              if (signedUrlError) {
                console.error('Error getting signed URL:', signedUrlError);
                throw signedUrlError;
              }

              if (!signedUrlData?.signedUrl) {
                console.error('No signed URL returned for image:', image);
                throw new Error('No signed URL returned');
              }

              console.log('Generated signed URL for image:', image.id, signedUrlData.signedUrl); // デバッグログ

              return {
                ...image,
                url: signedUrlData.signedUrl,
                size: Math.random() > 0.2 ? 'normal' : 'large',
                aspectRatio: getRandomAspectRatio(Math.random() > 0.2 ? 'normal' : 'large')
              };
            } catch (error) {
              console.error('Error processing image:', image.id, error);
              // エラーが発生した場合でも、既存のURLを使用
              return {
                ...image,
                url: image.url || '',
                size: Math.random() > 0.2 ? 'normal' : 'large',
                aspectRatio: getRandomAspectRatio(Math.random() > 0.2 ? 'normal' : 'large')
              };
            }
          })
        );

        console.log('Processed images with URLs:', imagesWithSignedUrls); // デバッグログ

        setImages(prev => {
          const newImages = pageNum === 1 ? imagesWithSignedUrls : [...prev, ...imagesWithSignedUrls];
          // 新しい画像が追加されたら、いいね状態を再取得
          if (user && newImages.length > prev.length) {
            fetchLikeStatus();
          }
          return newImages;
        });
        
        setHasMore(to < totalCount - 1);
        setRetryCount(0);
      }
    } catch (error) {
      console.error('Error fetching images:', error);
      setError('画像の読み込みに失敗しました。ネットワーク接続を確認してください。');
      toast({
        title: 'エラー',
        description: '画像の読み込みに失敗しました',
        variant: 'destructive',
      });
    }
  }, [supabase, toast, user, fetchLikeStatus]);

  // 初回読み込み
  useEffect(() => {
    fetchImages(1);
  }, [fetchImages]);

  // 無限スクロール
  useEffect(() => {
    if (inView && !loading && hasMore && !error) {
      setPage(prev => prev + 1);
      fetchImages(page + 1);
    }
  }, [inView, loading, hasMore, fetchImages, page, error]);

  const handleImageClick = (index: number) => {
    setSelectedImageIndex(index);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedImageIndex(-1);
  };

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
              <Button
                variant="link"
                className="ml-2 text-sm underline"
                onClick={handleRetryAll}
                disabled={retryCount >= MAX_RETRIES}
              >
                再読み込みする
              </Button>
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
                  onClick={() => handleImageClick(images.findIndex(img => img.id === image.id))}
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
                                handleRetryLoad(image.id);
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
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}