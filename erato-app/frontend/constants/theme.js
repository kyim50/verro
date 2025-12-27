// Theme based on Pinterest dark mode design

export const colors = {
  background: '#000000',
  surface: '#1a1a1a',
  surfaceLight: '#2a2a2a',
  surfaceElevated: '#3a3a3a',

  // Red as primary but used more sparingly
  primary: '#e60023',
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

  // Shorthand aliases for common status colors
  success: '#00a400',
  error: '#e60023',
  warning: '#ffba00',
  info: '#0099ff',
  
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
  overlayDark: 'rgba(0, 0, 0, 0.9)',
  overlayMedium: 'rgba(0, 0, 0, 0.8)',
  
  // Common UI colors
  likeColor: '#FF6B6B', // Heart/like color
  white: '#ffffff',
  
  shadow: {
    color: '#000000',
    opacity: 0.3,
  },
};

// Pinterest-style font family (system font for cross-platform)
export const fontFamily = {
  regular: 'System',
  medium: 'System',
  semibold: 'System',
  bold: 'System',
};

export const typography = {
  h1: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
    fontFamily: fontFamily.bold,
  },
  h2: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    fontFamily: fontFamily.bold,
  },
  h3: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    fontFamily: fontFamily.semibold,
  },
  body: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    fontFamily: fontFamily.regular,
  },
  bodyBold: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    fontFamily: fontFamily.semibold,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    fontFamily: fontFamily.regular,
  },
  small: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 14,
    fontFamily: fontFamily.regular,
  },
  button: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    fontFamily: fontFamily.semibold,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

// Unified border widths for consistency
export const borderWidth = {
  thin: 1,
  medium: 1.5,
  thick: 2,
};

// Common component styles for consistency across the app
export const components = {
  // Input fields (TextInput, etc.) - Pinterest style with white outline
  input: {
    height: 50,
    borderWidth: borderWidth.medium,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.body.fontSize,
    backgroundColor: colors.background,
  },
  // Buttons
  button: {
    height: 48,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonSmall: {
    height: 36,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Cards and containers
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
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
  tabBarHeight: 70,
  headerHeight: 60,
  screenPadding: spacing.lg,
};

// Default avatar for users without profile pictures - simple gray circle with person icon
export const DEFAULT_AVATAR = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%233a3a3a"/%3E%3Cpath d="M50 45c8.284 0 15-6.716 15-15s-6.716-15-15-15-15 6.716-15 15 6.716 15 15 15zm0 7.5c-12.426 0-37.5 6.234-37.5 18.75V82.5h75V71.25c0-12.516-25.074-18.75-37.5-18.75z" fill="%23ffffff"/%3E%3C/svg%3E';
