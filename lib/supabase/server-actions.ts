import { createClient } from './server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function signOut() {
  const cookieStore = cookies();
  const supabase = createClient();
  
  await supabase.auth.signOut();
  return redirect('/login');
}

export async function getUserSession() {
  const supabase = createClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session) {
    return null;
  }
  
  return session;
}

export async function getLikedImages(userId: string) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('likes')
    .select('image_id')
    .eq('user_id', userId);
    
  if (error) {
    console.error('Error fetching liked images:', error);
    return [];
  }
  
  return data.map(like => like.image_id);
}

export async function getImageLikes(imageId: string) {
  const supabase = createClient();
  
  const { count, error } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('image_id', imageId);
    
  if (error) {
    console.error('Error fetching image likes:', error);
    return 0;
  }
  
  return count || 0;
}