'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/components/auth/auth-provider';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Image as ImageType } from '@/lib/types';

export function ImageCard({ image, onUnlike }: { 
  image: ImageType;
  onUnlike?: (imageId: string) => void;  // 新しいプロップス
}){
  console.log('ImageCard received image:', image);

  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkLikeStatus = async () => {
      if (!user) return;
      
      try {
        console.log('Checking like status for image:', image.id);
        const response = await fetch(`/api/likes?image_id=${image.id}`);
        if (!response.ok) throw new Error('Failed to check like status');
        
        const data = await response.json();
        console.log('Like status check:', data);
        setIsLiked(data.isLiked);
      } catch (error) {
        console.error('Error checking like status:', error);
      }
    };

    checkLikeStatus();
  }, [user, image.id]);

  const handleLike = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      if (isLiked) {
        const response = await fetch('/api/likes', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image_id: image.id }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to unlike');
        }
        setIsLiked(false);
        onUnlike?.(image.id);
        console.log('Unliked successfully');
      } else {
        const response = await fetch('/api/likes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image_id: image.id }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to like');
        }
        setIsLiked(true);
        console.log('Liked successfully');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update like status",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative group">
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="relative aspect-square">
            <Image
              src={image.url}
              alt={image.title || ''}
              fill
              className="object-cover"
            />
          </div>
        </CardContent>
        <CardFooter className="p-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLike}
            disabled={isLoading}
            className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm"
          >
            {isLiked ? (
              <Heart className="h-4 w-4 text-red-500 fill-red-500" />
            ) : (
              <Heart className="h-4 w-4" />
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}