import { moderateScale } from 'react-native-size-matters';

export const colors = {
  primary: '#F4C20D',
  primarySoft: '#FFF7D6',
  primaryBorder: '#FDE68A',
  ink: '#111827',
  text: '#111827',
  muted: '#6B7280',
  bg: '#F6F7FB',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  danger: '#EF4444',
  success: '#16A34A',
  path: '#000'
};

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

export const type = {
  h1: {
    fontFamily: fontFamily.extrabold,
    fontSize: moderateScale(24),
    fontWeight: '800',
    color: colors.text,
  },
  h2: {
    fontFamily: fontFamily.bold,
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: colors.text,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontFamily: fontFamily.semibold,
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: colors.ink,
  },
  body: {
    fontFamily: fontFamily.medium,
    fontSize: moderateScale(14),
    fontWeight: '500',
    color: colors.text,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: moderateScale(13),
    fontWeight: '500',
    color: colors.muted,
  },
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: moderateScale(12),
    fontWeight: '400',
    color: colors.muted,
  },
  button: {
    fontFamily: fontFamily.semibold,
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: colors.surface,
  },
  default: {
    fontFamily: fontFamily.regular,
    fontSize: moderateScale(14),
    fontWeight: '400',
    color: colors.text,
  },
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
};

export const theme = { colors, radii, spacing, type, shadow };

