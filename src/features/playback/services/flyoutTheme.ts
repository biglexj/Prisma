export const FLYOUT_THEME_EVENT = "prisma://flyout-theme-sync";
export interface FlyoutTheme {
  mode: "light" | "dark";
  primary: string;
  secondary: string;
}
