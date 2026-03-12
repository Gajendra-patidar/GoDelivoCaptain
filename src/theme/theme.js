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

export const type = {
  h1: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    color: colors.text,
  },
  h2: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: colors.text,
  },
  body: {
    fontSize: moderateScale(14),
    fontWeight: '500',
    color: colors.text,
  },
  sub: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: colors.muted,
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

