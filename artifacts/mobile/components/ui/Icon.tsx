import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { colors } from '@/constants/colors';
import { icons, type IconName } from '@/constants/icons';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function Icon({ name, size = 20, color = colors.foreground, style }: Props) {
  return <SvgXml xml={icons[name]} width={size} height={size} color={color} style={style} />;
}
