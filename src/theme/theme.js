import { moderateScale } from 'react-native-size-matters';

export const BRAND_YELLOW = '#fdd31f';
export const BRAND_BLACK = '#000000';

export const lightColors = {
  primary: BRAND_YELLOW,
  primarySoft: '#FFF7D6',
  primaryBorder: '#F7D94C',
  ink: BRAND_BLACK,
  text: BRAND_BLACK,
  muted: '#5F6368',
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F8F9FA',
  border: '#E5E7EB',
  danger: '#EF4444',
  success: '#16A34A',
  path: BRAND_BLACK,
  inverse: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.55)',
};

export const darkColors = {
  primary: BRAND_YELLOW,
  primarySoft: '#FFF7D6',
  primaryBorder: '#F7D94C',
  ink: BRAND_BLACK,
  text: BRAND_BLACK,
  muted: '#5F6368',
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F8F9FA',
  border: '#E5E7EB',
  danger: '#EF4444',
  success: '#16A34A',
  path: BRAND_BLACK,
  inverse: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.55)',
};

export const getColorsForScheme = () =>
  lightColors;

export const radii = {
  sm: moderateScale(10),
  md: moderateScale(14),
  lg: moderateScale(18),
  xl: moderateScale(24),
  pill: 999,
};

export const spacing = {
  xs: moderateScale(6),
  sm: moderateScale(10),
  md: moderateScale(14),
  lg: moderateScale(18),
  xl: moderateScale(24),
};

const fontFamily = {
  regular: 'Poppins-Regular',
  medium: 'Poppins-Medium',
  semibold: 'Poppins-SemiBold',
  bold: 'Poppins-Bold',
  extrabold: 'Poppins-ExtraBold',
};

const createType = palette => ({
  h1: {
    fontFamily: fontFamily.extrabold,
    fontSize: moderateScale(24),
    fontWeight: '800',
    color: palette.text,
  },
  h2: {
    fontFamily: fontFamily.bold,
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: palette.text,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: palette.text,
  },
  subtitle: {
    fontFamily: fontFamily.semibold,
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: palette.ink,
  },
  body: {
    fontFamily: fontFamily.medium,
    fontSize: moderateScale(14),
    fontWeight: '500',
    color: palette.text,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: moderateScale(13),
    fontWeight: '500',
    color: palette.muted,
  },
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: moderateScale(12),
    fontWeight: '400',
    color: palette.muted,
  },
  button: {
    fontFamily: fontFamily.semibold,
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: BRAND_BLACK,
  },
  default: {
    fontFamily: fontFamily.regular,
    fontSize: moderateScale(14),
    fontWeight: '400',
    color: palette.text,
  },
});

const createShadow = scheme => ({
  card: {
    shadowColor: BRAND_BLACK,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: scheme === 'dark' ? 0.16 : 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
});

export const createTheme = scheme => {
  const normalizedScheme = 'light';
  const palette = getColorsForScheme(normalizedScheme);

  return {
    mode: normalizedScheme,
    colors: palette,
    radii,
    spacing,
    type: createType(palette),
    shadow: createShadow(normalizedScheme),
  };
};

export const getThemeForScheme = createTheme;

const initialScheme = 'light';

export const theme = createTheme(initialScheme);
export const colors = theme.colors;
export const type = theme.type;
export const shadow = theme.shadow;
export const lightTheme = createTheme('light');
export const darkTheme = createTheme('dark');
