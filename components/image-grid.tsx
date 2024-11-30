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

  // いいね状態を取得する関数
  const fetchLikeStatus = useCallback(async () => {
    if (!user || images.length === 0) return;

    try {
      // バッチ処理：一度に5つずつ処理
      const batchSize = 5;
      const batches = Math.ceil(images.length / batchSize);
      const likedImageIds = new Set<string>();

      for (let i = 0; i < batches; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, images.length);
        const batchImages = images.slice(start, end);

        const results = await Promise.all(
          batchImages.map(async (image) => {
            try {
              const response = await fetch(`/api/likes?image_id=${image.id}`);
              if (!response.ok) throw new Error('Network response was not ok');
              return response.json();
            } catch (error) {
              console.error(`Error fetching like status for image ${image.id}:`, error);
              return { isLiked: false };
            }
          })
        );

        results.forEach((result, index) => {
          if (result?.isLiked) {
            likedImageIds.add(batchImages[index].id);
          }
        });

        // バッチ間で少し待機
        if (i < batches - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setLikedImages(likedImageIds);
    } catch (error) {
      console.error('Error fetching like status:', error);
      toast({
        title: 'エラー',
        description: 'いいね状態の取得に失敗しました',
        variant: 'destructive',
      });
    }
  }, [user, images, toast]);

  // 画像の読み込み完了を追跡する関数
  const handleImageLoad = (imageId: string) => {
    setLoadedImages(prev => {
      const newSet = new Set(prev);
      newSet.add(imageId);
      if (newSet.size >= 4 || newSet.size === images.length) {
        setLoading(false);
      }
      return newSet;
    });
    // 読み込みに成功した画像をfailedImagesから削除
    setFailedImages(prev => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      return newSet;
    });
  };

  // 画像の読み込みエラーを処理する関数
  const handleImageError = (imageId: string) => {
    console.error(`Failed to load image: ${imageId}`);
    setFailedImages(prev => {
      const newSet = new Set(prev);
      newSet.add(imageId);
      return newSet;
    });
  };

  // 画像の再読み込みを試みる関数
  const handleRetryLoad = async (imageId: string) => {
    try {
      setFailedImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(imageId);
        return newSet;
      });

      // 画像のURLを再取得
      const { data: imageData, error: imageError } = await supabase
        .storage
        .from('photo-gallery-images')
        .createSignedUrl(images.find(img => img.id === imageId)?.storage_path || '', 60);

      if (imageError) throw imageError;

      // 画像URLを更新
      setImages(prev => prev.map(img => 
        img.id === imageId 
          ? { ...img, url: imageData.signedUrl }
          : img
      ));

    } catch (error) {
      console.error('Error retrying image load:', error);
      handleImageError(imageId);
    }
  };

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

  // 画像データの取得（ページネーション対応）
  const fetchImages = useCallback(async (pageNum: number) => {
    try {
      setError(null);
      const from = (pageNum - 1) * (pageNum === 1 ? INITIAL_LOAD_COUNT : LOAD_MORE_COUNT);
      
      // 最大件数を超えないようにチェック
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
        // 署名付きURLを取得
        const imagesWithSignedUrls = await Promise.all(
          data.map(async (image) => {
            try {
              const { data: signedUrlData, error: signedUrlError } = await supabase
                .storage
                .from('photo-gallery-images')
                .createSignedUrl(image.storage_path, 3600); // 有効期限を1時間に延長

              if (signedUrlError) throw signedUrlError;

              return {
                ...image,
                url: signedUrlData.signedUrl,
                size: Math.random() > 0.2 ? 'normal' : 'large',
                aspectRatio: getRandomAspectRatio(Math.random() > 0.2 ? 'normal' : 'large')
              };
            } catch (error) {
              console.error('Error getting signed URL:', error);
              return {
                ...image,
                size: Math.random() > 0.2 ? 'normal' : 'large',
                aspectRatio: getRandomAspectRatio(Math.random() > 0.2 ? 'normal' : 'large')
              };
            }
          })
        );

        setImages(prev => pageNum === 1 ? imagesWithSignedUrls : [...prev, ...imagesWithSignedUrls]);
        setHasMore(to < totalCount - 1);
        setRetryCount(0); // 成功したらリトライカウントをリセット
      }
    } catch (error) {
      console.error('Error fetching images:', error);
      setError('画像の読み込みに失敗しました。ネットワーク接続を確認してください。');
      toast({
        title: 'エラー',
        description: '画像の読み込みに失敗しました',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [supabase, toast]);

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

  // いいね状態の取得
  useEffect(() => {
    if (user && images.length > 0) {
      fetchLikeStatus();
    }
  }, [user, images, fetchLikeStatus]);

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
              {images.map((image, index) => (
                <div 
                  key={image.id} 
                  className="mb-4 cursor-pointer"
                  onClick={() => handleImageClick(index)}
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
                            loading={index < 4 ? "eager" : "lazy"}
                            placeholder="blur"
                            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDABQODxIPDRQSEBIXFRQdHx4eHRoaHSQrJiEkKic0Ly4vLy4vNDk2ODU4Ni8vQUFBQC9JWTI/SVpwWnGNkY3/2wBDARUXFx4aHR4eHUJBQkFGQ0ZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkb/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                          />
                        )}
                      </div>
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