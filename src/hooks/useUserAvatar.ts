import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';

const AVATAR_PEEKING = require('../../assets/images/avatar_peeking_cropped.png');

export function useUserAvatar() {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const isFocused = useIsFocused();

  const fetchAvatar = useCallback(async () => {
    try {
      // 1. Try local cache first
      const cached = await AsyncStorage.getItem('user_avatar_url');
      if (cached) {
        setAvatarUrl(cached);
      }

      // 2. Fetch from Supabase profiles (own avatar only — never borrow another profile's)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await (supabase as any)
          .from('profiles')
          .select('avatar_url')
          .eq('id', session.user.id)
          .single();

        if (profile?.avatar_url) {
          setAvatarUrl(profile.avatar_url);
          await AsyncStorage.setItem('user_avatar_url', profile.avatar_url);
        } else {
          // No avatar set → clear stale cache so the default icon shows
          setAvatarUrl(null);
          await AsyncStorage.removeItem('user_avatar_url');
        }
      }
    } catch (err) {
      console.warn('Error fetching user avatar:', err);
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      fetchAvatar();
    }
  }, [isFocused, fetchAvatar]);

  const avatarSource = avatarUrl ? { uri: avatarUrl } : AVATAR_PEEKING;

  return {
    avatarUrl,
    avatarSource,
    refreshAvatar: fetchAvatar,
  };
}
