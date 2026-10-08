import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '@/constants/colors';
import { radius, shadow } from '@/constants/layout';
import { images } from '@/constants/images';

type Props = {
  /** Outer tile size (Sleek `size-8` … `size-20`). */
  size: number;
  padding?: number;
  rounded?: keyof typeof radius;
  elevation?: keyof typeof shadow | null;
  style?: StyleProp<ViewStyle>;
};

/** Rideshare Chats logo mark inside a bordered card tile. */
export function LogoTile({ size, padding = 4, rounded = 'xl', elevation = 'xs', style }: Props) {
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, padding, borderRadius: radius[rounded] },
        elevation ? shadow[elevation] : null,
        style,
      ]}
    >
      <Image source={images.logoMark} style={styles.image} contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
