export const SIDEBAR_WIDTH = {
  COLLAPSED: 64, // w-16
  EXPANDED_MOBILE: 288, // w-72
  EXPANDED_TABLET: 256, // w-64
  EXPANDED_DESKTOP: 288, // w-72
} as const;

export const ANIMATION_DURATION = {
  SHORT: 200,
  MEDIUM: 300,
  LONG: 500,
} as const;

export const AVATAR_SIZE = {
  SMALL: 36, // w-9 h-9
  MEDIUM: 44, // w-11 h-11
  LARGE: 48, // w-12 h-12
} as const;

export const FOCUS_RING_CLASSES = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vermillion-500 focus-visible:ring-offset-2' as const;
