'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

export type Image = {
  id: string;
  title: string;
  url: string;
  description?: string;
  storage_path: string;
  created_at: string;
  updated_at: string;
};

export function useDownload() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const downloadSingleImage = async (image: Image): Promise<void> => {
    try {
      const response = await fetch(image.url);
      if (!response.ok) throw new Error(`Failed to fetch ${image.title}`);
      
      const blob = await response.blob();
      const fileName = `${image.title || 'image'}.jpg`;
      
      // iOSの判定
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      if (isIOS && navigator.share) {
        // Share APIを使用
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        try {
          await navigator.share({
            files: [file],
            title: fileName,
          });
        } catch (error) {
          console.error('Share error:', error);
          // Share APIが失敗した場合のフォールバック
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
          URL.revokeObjectURL(url);
        }
      } else {
        // Android/PC用の既存の処理
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      // Add delay between downloads
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Download error:', error);
      throw new Error(`Failed to download ${image.title}`);
    }
  };

  const downloadImages = async (images: Image[]): Promise<void> => {
    if (images.length === 0) {
      toast({
        title: 'No images',
        description: 'No images to download',
      });
      return;
    }

    setIsDownloading(true);
    setProgress(0);

    try {
      let successCount = 0;
      for (let i = 0; i < images.length; i++) {
        try {
          await downloadSingleImage(images[i]);
          successCount++;
          setProgress(((i + 1) / images.length) * 100);
        } catch (error) {
          console.error(error);
          toast({
            title: '警告',
            description: `ダウンロード失敗 ${images[i].title}`,
            variant: 'destructive',
          });
        }
      }

      if (successCount > 0) {
        toast({
          title: '実行',
          description: `ダウンロード中 ${successCount} out of ${images.length} images`,
        });
      }
    } catch (error) {
      toast({
        title: '失敗',
        description: 'ダウンロードできませんでした',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
      setProgress(0);
    }
  };

  return {
    downloadImages,
    isDownloading,
    progress
  };
}