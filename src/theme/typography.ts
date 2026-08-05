export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayRegular: 'Fraunces_400Regular',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
};

export function fontStyle(
  family: keyof typeof fonts,
  size: number,
  extra?: { color?: string; lineHeight?: number },
) {
  return {
    fontFamily: fonts[family],
    fontSize: size,
    color: extra?.color,
    lineHeight: extra?.lineHeight,
  };
}
