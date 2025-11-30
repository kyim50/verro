// Theme based on Pinterest dark mode design

export const colors = {
  background: '#000000',
  surface: '#1a1a1a',
  surfaceLight: '#2a2a2a',
  surfaceElevated: '#3a3a3a',
  
  primary: '#e60023', // Pinterest red
  primaryDark: '#ad081b',
  primaryLight: '#ff1744',
  
  text: {
    primary: '#ffffff',
    secondary: '#b3b3b3',
    disabled: '#666666',
    inverse: '#000000',
  },
  
  border: '#3a3a3a',
  borderLight: '#4a4a4a',
  
  status: {
    success: '#00a400',
    warning: '#ffba00',
    error: '#e60023',
    info: '#0099ff',
  },
  
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
  
  shadow: {
    color: '#000000',
    opacity: 0.3,
  },
};

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  small: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  button: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const shadows = {
  small: {
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const layout = {
  tabBarHeight: 80,
  headerHeight: 60,
  screenPadding: spacing.md,
};
