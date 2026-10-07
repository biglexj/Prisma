/** Display names match Super Gallery's localized Android app_name resources. */
const NAMES: Record<string, string> = {
  es: "Super Galería",
  en: "Super Gallery",
  pt: "Super Galeria",
  it: "Super Galleria",
  de: "Super Galerie",
  fr: "Super Galerie",
};

export function superGalleryName(language = document.documentElement.lang || "es"): string {
  return NAMES[language.toLowerCase().split(/[-_]/)[0]] ?? NAMES.en;
}
