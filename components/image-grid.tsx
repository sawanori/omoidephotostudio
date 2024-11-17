'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Masonry from 'react-masonry-css';
import Image from 'next/image';
import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Heart, Loader2 } from 'lucide-react';
import { ImageModal } from '@/components/image-modal';
import { Image as ImageType } from '@/lib/supabase/types';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { useLikeStore } from '@/lib/store/like-store';


export function ImageGrid() {
  const [images, setImages] = useState<ImageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const supabase = createClientComponentClient();
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(-1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const [likedImages, setLikedImages] = useState<Set<string>>(new Set());
  const [loadingLikes, setLoadingLikes] = useState<Set<string>>(new Set());

  // 画像の読み込み完了を追跡する関数
  const handleImageLoad = (imageId: string, index: number) => {
    setLoadedImages(prev => {
      const newSet = new Set(prev);
      newSet.add(imageId);
      // 最初の4枚の画像が読み込まれたらローディングを終了
      if (newSet.size >= 4 || newSet.size === images.length) {
        setLoading(false);
      }
      return newSet;
    });
  };

  // いいね状態を取得する関数
  const fetchLikeStatus = useCallback(async () => {
    if (!user) return;

    try {
      const promises = images.map(image =>
        fetch(`/api/likes?image_id=${image.id}`).then(res => res.json())
      );

      const results = await Promise.all(promises);
      
      setLikedImages(prev => {
        const newLikedImages = new Set(prev);
        results.forEach((result, index) => {
          const imageId = images[index].id;
          if (result.isLiked) {
            newLikedImages.add(imageId);
          }
        });
        return newLikedImages;
      });
    } catch (error) {
      console.error('Error fetching like status:', error);
    }
  }, [user, images]);

  // ランダムなサイズクラスを生成する関数を追加
  const getRandomSize = () => {
    // 80%の確率で通常サイズ、20%の確率で大きいサイズ
    const random = Math.random();
    return random > 0.2 ? 'normal' : 'large';
  };

  // アスペクト比の設定を調整
  const getRandomAspectRatio = (size: 'normal' | 'large') => {
    if (size === 'large') {
      // 大きいサイズの場合は横長か正方形
      const ratios = [
        'aspect-[16/9]',  // 横長 (16:9)
        'aspect-square',  // 正方形 (1:1)
      ];
      return ratios[Math.floor(Math.random() * ratios.length)];
    }

    // 通常サイズの場合は縦長多め
    const ratios = [
      { class: 'aspect-[3/4]', weight: 2 },   // 縦長 (3:4)
      { class: 'aspect-[4/3]', weight: 1 },   // 横長 (4:3)
      { class: 'aspect-square', weight: 1 }    // 正方形 (1:1)
    ];

    const weightedRatios = ratios.flatMap(ratio => 
      Array(ratio.weight).fill(ratio.class)
    );

    return weightedRatios[Math.floor(Math.random() * weightedRatios.length)];
  };

  // 画像データ取得時にサイズとアスペクト比を付与
  const fetchImages = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('images')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const imagesWithProperties = data.map(image => {
          const size = getRandomSize();
          return {
            ...image,
            size,
            aspectRatio: getRandomAspectRatio(size)
          };
        });
        setImages(imagesWithProperties);
      }
    } catch (error) {
      console.error('Error fetching images:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // 初回読み込み
  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // いいね状態の取得
  useEffect(() => {
    if (images.length > 0 && user) {
      fetchLikeStatus();
    }
  }, [images, user, fetchLikeStatus]);

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
        title: 'Error',
        description: 'Please login to like images',
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

      if (!response.ok) throw new Error();

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
      toast({
        title: 'Error',
        description: 'Failed to update like',
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
    default: 4,    // 1536px以上
    1536: 4,       // 1280px-1536px
    1280: 3,       // 1024px-1280px
    1024: 3,       // 768px-1024px
    768: 2,        // 640px-768px
    640: 2         // 640px未満も2カラム
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center items-center min-h-[200px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
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
                      <Image
                        src={image.url}
                        alt={image.title}
                        fill
                        className="object-cover transition-transform duration-200 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        onLoad={() => handleImageLoad(image.id, index)}
                        priority={index < 4}
                      />
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </Masonry>
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