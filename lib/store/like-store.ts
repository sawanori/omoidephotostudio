import { create } from 'zustand';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface LikeStore {
  likedCount: number;
  setLikedCount: (count: number) => void;
  updateLikedCount: (userId: string) => Promise<void>;
  incrementLikedCount: () => void;
  decrementLikedCount: () => void;
}

export const useLikeStore = create<LikeStore>((set) => ({
  likedCount: 0,
  setLikedCount: (count) => set({ likedCount: count }),
  updateLikedCount: async (userId: string) => {
    try {
      const supabase = createClientComponentClient();
      const { count, error } = await supabase
        .from('likes')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      if (error) throw error;

      set({ likedCount: count || 0 });
    } catch (error) {
      console.error('Error updating like count:', error);
    }
  },
  incrementLikedCount: () => set((state) => ({ likedCount: state.likedCount + 1 })),
  decrementLikedCount: () => set((state) => ({ likedCount: Math.max(0, state.likedCount - 1) })),
}));

export default useLikeStore;