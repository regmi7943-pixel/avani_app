import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUserAvatar } from '../hooks/useUserAvatar';

interface UserProfileIconProps {
  size?: number;
  onPress?: () => void;
  borderColor?: string;
}

export default function UserProfileIcon({
  size = 36,
  onPress,
  borderColor = '#d8ecd8',
}: UserProfileIconProps) {
  const { avatarUrl } = useUserAvatar();
  const borderRadius = size / 2;

  const content = avatarUrl ? (
    <Image
      source={{ uri: avatarUrl }}
      style={[
        styles.avatarImage,
        { width: size, height: size, borderRadius, borderColor },
      ]}
      resizeMode="cover"
      fadeDuration={0}
    />
  ) : (
    <View
      style={[
        styles.fallbackCircle,
        { width: size, height: size, borderRadius, borderColor },
      ]}
    >
      <Ionicons name="person" size={Math.round(size * 0.55)} color="#8a8f7e" />
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  avatarImage: {
    borderWidth: 1.5,
  },
  fallbackCircle: {
    backgroundColor: '#eef0ea',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
