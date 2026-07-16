import type { IStation } from "@/models/Station";
import { SITE_URL } from "@/constants/constants";
import { getValidImageUrl } from "@/utils";

export const DEFAULT_SHARE_IMAGE = `${SITE_URL}/favicon/android-chrome-512x512.png`;

const absoluteImageUrl = (path: string) => {
  if (path.startsWith("http")) return path;
  return `${SITE_URL}${path}`;
};

// Meta descriptions must be a single line and fit in a SERP snippet;
// station descriptions arrive as multi-paragraph text with raw \r\n.
export const metaDescription = (text: string, maxLength = 155) => {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  const cut = clean.slice(0, maxLength - 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
};

// Single source of truth for the station title pattern — used by the SSR
// head (seoStation) and the client-side document.title update (RadioApp).
export const stationTitle = (title?: string | null) =>
  `${title || "Radio Creștin"} | Ascultă Live Radio Creștin Online`;

export const seoStation = (station: IStation) => {
  return {
    title: stationTitle(station?.title),
    description: station?.description
      ? metaDescription(
          `Ascultă ${station.title} live online, gratuit. ${station.description}`,
        )
      : SEO_DEFAULT.description,
    imageUrl: absoluteImageUrl(
      getValidImageUrl(
        station?.thumbnail_url,
        "/favicon/android-chrome-512x512.png",
      ),
    ),
    fullURL: station?.slug
      ? `${SITE_URL}/${station.slug}/`
      : SEO_DEFAULT.fullURL,
  };
};

export const SEO_DEFAULT = {
  title: "Radio Creștin | Ascultă Radiouri Creștine Online Gratuit",
  description:
    "Ascultă peste 60 de radiouri creștine online gratuit pe RadioCrestin.ro. Muzică creștină, predici, emisiuni live - toate la un click distanță!",
  imageUrl: DEFAULT_SHARE_IMAGE,
  fullURL: `${SITE_URL}/`,
};

export const SEO_404 = {
  title: "Stația nu a fost găsită | Radio Creștin",
  description:
    "Stația radio căutată nu a fost găsită. Descoperă peste 60 de radiouri creștine online gratuit pe RadioCrestin.ro.",
  imageUrl: DEFAULT_SHARE_IMAGE,
  fullURL: `${SITE_URL}/`,
  noindex: true,
};

export const seoInternalErrorPage = {
  title: `A apărut o eroare neașteptată`,
};

export const SEO_STATISTICI = {
  title: "Statistici Ascultători Radiouri Creștine | Radio Creștin",
  description:
    "Vezi câți ascultători au radiourile creștine în timp real. Statistici live pentru toate stațiile radio creștine de pe RadioCrestin.ro.",
  imageUrl: DEFAULT_SHARE_IMAGE,
  fullURL: `${SITE_URL}/statistici/`,
};

export const SEO_FAQ = {
  title: "Întrebări Frecvente (FAQ) | Radio Creștin",
  description:
    "Răspunsuri la cele mai frecvente întrebări despre Radio Creștin. Află cum să asculți radiouri creștine online, cum să adaugi o stație și multe altele.",
  imageUrl: DEFAULT_SHARE_IMAGE,
  fullURL: `${SITE_URL}/intrebari-frecvente/`,
};

export const SEO_MUZICA_CRESTINA = {
  title: "Muzică Creștină Online – Ascultă Gratuit | Radio Creștin",
  description:
    "Ascultă muzică creștină online gratuit: worship, cântări vechi, gospel și muzică nouă, non-stop, pe zeci de radiouri creștine. Fără cont, fără reclame.",
  imageUrl: DEFAULT_SHARE_IMAGE,
  fullURL: `${SITE_URL}/muzica-crestina/`,
};

export const SEO_PREDICI = {
  title: "Predici Creștine Audio – Ascultă Online | Radio Creștin",
  description:
    "Ascultă predici creștine audio online: mesaje biblice, învățătură și emisiuni de zidire sufletească, non-stop, gratuit, pe radiourile creștine cu predici.",
  imageUrl: DEFAULT_SHARE_IMAGE,
  fullURL: `${SITE_URL}/predici/`,
};

export const SEO_RADIO_COPII = {
  title: "Radio Creștin pentru Copii – Ascultă Online Gratuit",
  description:
    "Radio creștin pentru copii: cântecele creștine, povestiri biblice și emisiuni pentru cei mici. Ascultă online gratuit stațiile creștine pentru copii.",
  imageUrl: DEFAULT_SHARE_IMAGE,
  fullURL: `${SITE_URL}/radio-crestin-pentru-copii/`,
};

export const SEO_CHURCH_HUB = {
  title: "Church Hub: Program Gratuit de Proiecție Versuri la Biserică",
  description:
    "Church Hub: program gratuit de proiecție versuri și versete pentru biserică — alternativă open-source la EasyWorship. 40.000+ cântări. Windows/macOS.",
  imageUrl: `${SITE_URL}/images/church-hub/control-room.png`,
  fullURL: `${SITE_URL}/church-hub/`,
};
