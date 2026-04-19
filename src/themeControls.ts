export type Mode = "light" | "dark" | "system";
export type BgPalette =
  | "white"
  | "mist"
  | "stone"
  | "slate"
  | "sand"
  | "dune"
  | "bluegray"
  | "graphite"
  | "ink";
export type Palette =
  | "sage"
  | "ocean"
  | "rose"
  | "clay"
  | "moss"
  | "slate"
  | "indigo"
  | "violet"
  | "sky"
  | "amber"
  | "fuchsia"
  | "neutral";
export type AccentColor =
  | "coral"
  | "emerald"
  | "indigo"
  | "sky"
  | "violet"
  | "rose"
  | "teal"
  | "amber"
  | "lime"
  | "slate"
  | "plum"
  | "mint";
export type AlertTone =
  | "accent"
  | "background"
  | "green"
  | "mint"
  | "teal"
  | "blue"
  | "sky"
  | "violet"
  | "amber"
  | "orange"
  | "rose"
  | "red"
  | "slate";
export type AlertStrength = "subtle" | "muted" | "strong";
export type BodyFont = "lexend" | "mono";
export type HeadingFont = "lexend" | "mono";
export type FontScale = "smaller" | "regular" | "larger";
export type RadiusPack = "none" | "sharp" | "soft" | "pill";
export type ElevationPack = "flat" | "subtle" | "dramatic";

export type AppearanceSettings = {
  mode: Mode;
  bgPalette: BgPalette;
  palette: Palette;
  accentColor: AccentColor;
  alertSuccessTone: AlertTone;
  alertSuccessStrength: AlertStrength;
  alertInfoTone: AlertTone;
  alertInfoStrength: AlertStrength;
  alertWarningTone: AlertTone;
  alertWarningStrength: AlertStrength;
  alertDangerTone: AlertTone;
  bodyFont: BodyFont;
  headingFont: HeadingFont;
  fontScale: FontScale;
  radius: RadiusPack;
  elevation: ElevationPack;
};

export const defaultAppearanceSettings: AppearanceSettings = {
  mode: "system",
  bgPalette: "white",
  palette: "sage",
  accentColor: "coral",
  alertSuccessTone: "accent",
  alertSuccessStrength: "subtle",
  alertInfoTone: "background",
  alertInfoStrength: "subtle",
  alertWarningTone: "accent",
  alertWarningStrength: "strong",
  alertDangerTone: "red",
  bodyFont: "lexend",
  headingFont: "lexend",
  fontScale: "regular",
  radius: "sharp",
  elevation: "flat",
};
