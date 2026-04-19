import type { BodyFont, HeadingFont } from "../themeControls.ts";

const FONT_CDN_BASE_URL = "https://cdn.staticdelivr.com/gfonts/css2?family=";

const fontFamilyByChoice: Record<BodyFont | HeadingFont, string> = {
  lexend: "Lexend+Deca:wght@400;500;600",
  mono: "JetBrains+Mono:wght@400;500;600",
};

const loadedFontChoices = new Set<string>();

function ensureFontStylesheet(choice: BodyFont | HeadingFont): void {
  if (loadedFontChoices.has(choice)) {
    return;
  }

  const familyQuery = fontFamilyByChoice[choice];

  if (!familyQuery) {
    return;
  }

  const linkId = `void-note-font-${choice}`;

  if (document.getElementById(linkId)) {
    loadedFontChoices.add(choice);
    return;
  }

  const link = document.createElement("link");
  link.id = linkId;
  link.rel = "stylesheet";
  link.href = `${FONT_CDN_BASE_URL}${familyQuery}`;
  document.head.append(link);
  loadedFontChoices.add(choice);
}

export function ensureRuntimeFonts(
  bodyFont: BodyFont,
  headingFont: HeadingFont,
): void {
  ensureFontStylesheet(bodyFont);
  ensureFontStylesheet(headingFont);

  // Always load mono for code blocks using --font-code.
  ensureFontStylesheet("mono");
}
