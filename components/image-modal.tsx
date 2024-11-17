'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { Download, Share2, Twitter, Facebook, Link2, Heart } from 'lucide-react';
import { Image as ImageType } from '@/lib/supabase/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/components/auth/auth-provider';
import { useLikeStore } from '@/lib/store/like-store';
import { optimizeImage } from '@/utils/image-optimizer';

interface ImageModalProps {
  images: ImageType[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageModal({ images, initialIndex, isOpen, onClose }: ImageModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDownloading, setIsDownloading] = useState(false);
  const [likedImages, setLikedImages] = useState<Set<string>>(new Set());
  const [loadingLike, setLoadingLike] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { likedCount, setLikedCount } = useLikeStore();

  const currentImage = images[currentIndex];

  // いいね状態を取得する関数
  const fetchLikeStatus = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch(`/api/likes?image_id=${currentImage.id}`);
      if (!response.ok) throw new Error('Failed to fetch like status');
      
      const data = await response.json();
      
      setLikedImages(prev => {
        const newLikedImages = new Set(prev);
        if (data.isLiked) {
          newLikedImages.add(currentImage.id);
        } else {
          newLikedImages.delete(currentImage.id);
        }
        return newLikedImages;
      });
    } catch (error) {
      console.error('Error fetching like status:', error);
    }
  }, [user, currentImage.id]);

  // 画像が変更されたときにいいね状態を取得
  useEffect(() => {
    fetchLikeStatus();
  }, [currentIndex, fetchLikeStatus]);

  // モーダルが開かれたときにもいいね状態を取得
  useEffect(() => {
    if (isOpen) {
      fetchLikeStatus();
    }
  }, [isOpen, fetchLikeStatus]);

  const handleDownload = async (image: ImageType) => {
    setIsDownloading(true);
    try {
      // 画像を最適化
      const optimizedBlob = await optimizeImage(image.url);
      
      // Blobから直接ダウンロード
      const blobUrl = URL.createObjectURL(optimizedBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${image.title}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      toast({
        title: '成功',
        description: '写真のダウンロードが完了しました',
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: '失敗',
        description: 'ダウンロードが完了できませんでした。',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = (platform: 'twitter' | 'facebook') => {
    const shareUrl = window.location.href;
    const text = `Check out this image: ${currentImage.title}`;

    switch (platform) {
      case 'twitter':
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(
            text
          )}&url=${encodeURIComponent(shareUrl)}`,
          '_blank'
        );
        break;
      case 'facebook':
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
            shareUrl
          )}`,
          '_blank'
        );
        break;
    }
  };

  const handleLike = async () => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'Please login to like images',
        variant: 'destructive',
      });
      return;
    }

    setLoadingLike(true);
    try {
      const isLiked = likedImages.has(currentImage.id);
      const response = await fetch('/api/likes', {
        method: isLiked ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_id: currentImage.id }),
      });

      if (!response.ok) throw new Error();

      // UIの即時更新
      setLikedImages(prev => {
        const newLikes = new Set(prev);
        if (isLiked) {
          newLikes.delete(currentImage.id);
        } else {
          newLikes.add(currentImage.id);
        }
        return newLikes;
      });

      // ローバル状態を更新（データベースから正確な数を取得）
      if (user) {
        await useLikeStore.getState().updateLikedCount(user.id);
      }

    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update like',
        variant: 'destructive',
      });
    } finally {
      setLoadingLike(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100%-2rem)] sm:w-[600px] md:w-[800px] lg:w-[1000px] h-[500px] sm:h-[600px] md:h-[650px] lg:h-[700px] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{currentImage.title}</DialogTitle>
        </DialogHeader>

        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg">
          <Image
            src={currentImage.url}
            alt={currentImage.title}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 600px, (max-width: 1024px) 800px, 1000px"
          />
        </div>

        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">{currentImage.title}</h3>
          {currentImage.description && (
            <p className="text-muted-foreground mb-4">{currentImage.description}</p>
          )}
          
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => handleDownload(currentImage)}
              disabled={isDownloading}
            >
              <Download className="h-4 w-4" />
              {isDownloading ? 'ダウンロード中...' : 'ダウンロード'}
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleLike}
              disabled={loadingLike}
            >
              <Heart
                className={`h-4 w-4 ${
                  likedImages.has(currentImage.id) ? 'fill-current text-red-500' : ''
                }`}
              />
              {likedImages.has(currentImage.id) ? '選択中' : 'チョイス'}
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => handleShare('twitter')}
            >
              <Twitter className="h-4 w-4" />
              X(Twitter)
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => handleShare('facebook')}
            >
              <Facebook className="h-4 w-4" />
              Facebook
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}