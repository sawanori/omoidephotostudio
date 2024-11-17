'use client';

import { Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImageGrid } from '@/components/image-grid';
import { LikedImages } from '@/components/liked-images';
import { Header } from '@/components/header';
import { FloatingDownloadButton } from '@/components/floating-download-button';
import PhotoAlbum from "react-photo-album";

type Photo = {
  src: string;
  width: number;
  height: number;
  alt?: string;
};



export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="all">写真一覧</TabsTrigger>
            <TabsTrigger value="liked">お選びの写真</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <Suspense fallback={<div>読み込み中...</div>}>
              <ImageGrid />
            </Suspense>
          </TabsContent>
          <TabsContent value="liked">
            <Suspense fallback={<div>読み込み中...</div>}>
              <LikedImages />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
      <FloatingDownloadButton />
    </main>
  );
}