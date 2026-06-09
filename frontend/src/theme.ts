// Theme tokens for the SETP Edinburgh app — Aviation × Scottish heritage.
export const colors = {
  surface: "#F5F4F0",
  surfaceSecondary: "#FFFFFF",
  surfaceTertiary: "#EAE8E3",
  surfaceInverse: "#121822",

  onSurface: "#1A1C20",
  onSurfaceMuted: "#4A4D54",
  onSurfaceInverse: "#F5F4F0",

  brand: "#1A2841",        // aviation navy
  brandSecondary: "#4D5D78",
  brandTertiary: "#AD4C3B", // tartan ochre / heritage red
  onBrand: "#FFFFFF",

  success: "#2D6A4F",
  warning: "#D4A373",
  error: "#9E2A2B",
  info: "#4D5D78",

  border: "#E2DFD8",
  borderStrong: "#C2BDB2",
  divider: "#E2DFD8",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const typography = {
  display: "Georgia",       // serif fallback for Playfair-style display
  text: "System",
};

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
};
