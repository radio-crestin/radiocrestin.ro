import { IStation } from "@/models/Station";
import { SITE_URL } from "@/constants/constants";

const absoluteImageUrl = (path: string) => {
  if (path.startsWith("http")) return path;
  return `${SITE_URL}${path}`;
};

export const seoStation = (station: IStation) => {
  return {
    title: `${
      station?.title || "Radio Creștin"
    } | Ascultă Live Radio Creștin Online`,
    description: station?.description
      ? `Ascultă ${station.title} live online. ${station.description}`
      : SEO_DEFAULT.description,
    keywords: station?.title
      ? `${station.title}, ${station.title} live, radio crestin, radiocrestin, predici crestine, muzica crestina, radiouri crestine, radio crestin online, radiouri crestine online, radiocrestin.ro, online`
      : SEO_DEFAULT.keywords,
    imageUrl: absoluteImageUrl(station?.thumbnail_url || "/images/android-chrome-512x512.png"),
    fullURL: station?.slug
      ? `${SITE_URL}/${station.slug}`
      : SEO_DEFAULT.fullURL,
  };
};

export const SEO_DEFAULT = {
  title: "Radio Creștin | Ascultă Radiouri Creștine Online Gratuit",
  description:
    "Ascultă peste 50 de radiouri creștine online gratuit pe RadioCrestin.ro. Muzică creștină, predici, emisiuni live - toate la un click distanță!",
  keywords:
    "radio crestin, radiocrestin, radiouri crestine, radio crestin online, radiouri crestine online, radio crestine, radiocrestin.ro, muzica crestina, predici online",
  imageUrl: `${SITE_URL}/images/android-chrome-512x512.png`,
  fullURL: SITE_URL,
};

export const SEO_404 = {
  title: "Stația nu a fost găsită | Radio Creștin",
  description:
    "Stația radio căutată nu a fost găsită. Descoperă peste 50 de radiouri creștine online gratuit pe RadioCrestin.ro.",
  keywords:
    "radio crestin, radiocrestin, radiouri crestine, radio crestin online, radiouri crestine online, radio crestine, radiocrestin.ro, online",
  imageUrl: `${SITE_URL}/images/android-chrome-512x512.png`,
  fullURL: SITE_URL,
};

export const seoInternalErrorPage = {
  title: `A apărut o eroare neașteptată`,
};

export const SEO_STATISTICI = {
  title: "Statistici Ascultători Radiouri Creștine | Radio Creștin",
  description:
    "Vezi câți ascultători au radiourile creștine în timp real. Statistici live pentru toate stațiile radio creștine de pe RadioCrestin.ro.",
  keywords:
    "radio crestin, statistici, ascultatori radio crestin, radiocrestin, radiouri crestine, radio crestin online, radiocrestin.ro",
  imageUrl: `${SITE_URL}/images/android-chrome-512x512.png`,
  fullURL: `${SITE_URL}/statistici`,
};

export const SEO_FAQ = {
  title: "Întrebări Frecvente (FAQ) | Radio Creștin",
  description:
    "Răspunsuri la cele mai frecvente întrebări despre Radio Creștin. Află cum să asculți radiouri creștine online, cum să adaugi o stație și multe altele.",
  keywords:
    "radio crestin faq, intrebari frecvente, ajutor radio crestin, radiocrestin, radiouri crestine, radio crestin online, radiocrestin.ro",
  imageUrl: `${SITE_URL}/images/android-chrome-512x512.png`,
  fullURL: `${SITE_URL}/intrebari-frecvente`,
};

export const SEO_CHURCH_HUB = {
  title: "Church Hub - Software Gratuit pentru Biserica | Radio Crestin",
  description:
    "Church Hub - sistem modern de prezentare și management pentru servicii de închinare. Gestionează cântări, versete biblice, programe și transmiteri live.",
  keywords:
    "church hub, software biserica, prezentare biserica, cantari biserica, versete biblice, livestream biserica, software inchinare",
  imageUrl: `${SITE_URL}/images/church-hub/control-room.png`,
  fullURL: `${SITE_URL}/church-hub`,
};
