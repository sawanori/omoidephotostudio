'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useDropzone } from 'react-dropzone';
import { Progress } from '@/components/ui/progress';
import { cn } from "@/lib/utils"
interface FileWithPreview extends File {
  preview?: string;
}

interface UploadProgress {
  file: FileWithPreview;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export function ImageUpload() {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClientComponentClient();

  // ドラッグ&ドロップの実装
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const filesWithPreview = acceptedFiles.map(file => 
      Object.assign(file, {
        preview: URL.createObjectURL(file)
      })
    );
    setFiles(prev => [...prev, ...filesWithPreview]);
    setUploadProgress(prev => [
      ...prev,
      ...filesWithPreview.map(file => ({
        file,
        progress: 0,
        status: 'pending' as const
      }))
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif']
    },
    multiple: true
  });

  // 1ファイルずつアップロードする関数を修正
  const uploadFile = async (file: FileWithPreview, index: number) => {
    if (!user) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${fileName}`;

      // アップロード開始時のステータス更新
      setUploadProgress(prev => prev.map((p, i) => 
        i === index ? { ...p, status: 'uploading', progress: 0 } : p
      ));

      // ファイルを読み込んでArrayBufferとして準備
      const arrayBuffer = await file.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);

      // アップロードオプションの設定
      const options = {
        upsert: false,
        contentType: file.type,
      };

      // アップロード処理
      const { error: uploadError } = await supabase.storage
        .from('photo-gallery-images')
        .upload(filePath, fileData, {
          ...options,
          onUploadProgress: (event) => {
            if (event.total) {
              const percent = (event.loaded / event.total) * 100;
              console.log(`Uploading ${file.name}: ${percent}%`);
              setUploadProgress(prev => prev.map((p, i) => 
                i === index ? { ...p, progress: percent } : p
              ));
            }
          }
        });

      if (uploadError) throw uploadError;

      // 公開URLの取得
      const { data: { publicUrl } } = supabase
        .storage
        .from('photo-gallery-images')
        .getPublicUrl(filePath);

      // データベースへの保存
      const { error: dbError } = await supabase
        .from('images')
        .insert({
          title: title || file.name,
          description,
          user_id: user.id,
          storage_path: filePath,
          url: publicUrl,
        });

      if (dbError) throw dbError;

      // アップロード完了のステータス更新
      setUploadProgress(prev => prev.map((p, i) => 
        i === index ? { 
          ...p, 
          status: 'completed', 
          progress: 100 
        } : p
      ));

    } catch (error) {
      console.error('Upload error:', error);
      setUploadProgress(prev => prev.map((p, i) => 
        i === index ? { 
          ...p, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Upload failed',
          progress: 0 
        } : p
      ));
    }
  };

  // すべてのファイルを順番にアップロード
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: "Error",
        description: "Please login to upload images",
        variant: "destructive"
      });
      router.push('/login');
      return;
    }

    if (files.length === 0) {
      toast({
        title: "Error",
        description: "Please select files to upload",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // ファイルを1つずつ順番にアップロード
      for (let i = 0; i < files.length; i++) {
        await uploadFile(files[i], i);
      }

      toast({
        title: 'Success',
        description: 'All images uploaded successfully',
      });

      // アップロード完了後にリセット
      setFiles([]);
      setTitle('');
      setDescription('');
      setUploadProgress([]);

      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upload images',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Upload Images</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* ドラッグ&ドロップエリア */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              ${isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300'}`}
          >
            <input {...getInputProps()} />
            {isDragActive ? (
              <p>Drop the files here ...</p>
            ) : (
              <p>Drag 'n' drop some files here, or click to select files</p>
            )}
          </div>

          {/* プレビューとプログレス */}
          {uploadProgress.map((progress, index) => (
        <div key={index} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm truncate">{progress.file.name}</span>
            <span className="text-sm">
              {progress.status === 'completed' 
                ? 'Completed' 
                : progress.status === 'error'
                ? 'Error'
                : `${Math.round(progress.progress)}%`}
            </span>
          </div>
          <Progress 
            value={progress.progress} 
            className={cn(
              "h-2",
              progress.status === 'completed' && "bg-green-200",
              progress.status === 'error' && "bg-red-200"
            )}
          />
          {progress.status === 'error' && (
            <p className="text-sm text-destructive">{progress.error}</p>
          )}
        </div>
      ))}

          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Input
              type="text"
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={loading || files.length === 0}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Upload className="h-4 w-4 animate-spin" />
                Uploading...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload {files.length > 0 ? `(${files.length} files)` : ''}
              </span>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}