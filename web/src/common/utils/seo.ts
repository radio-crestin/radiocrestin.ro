import { IStation } from "@/models/Station";
import { SITE_URL } from "@/constants/constants";

export const seoStation = (station: IStation) => {
  return {
    title: `${
      station?.title || "Radio Creștin"
    } | Caută şi ascultă Radiouri Creştine online`,
    description: station?.description
      ? `${station.title} live ⭐. ${station.description}`
      : SEO_DEFAULT.description,
    keywords: station?.title
      ? `${station.title}, ${station.title} live, radio crestin, radiocrestin, predici crestine, muzica crestina, radiouri crestine, radio crestin online, radiouri crestine online, radiocrestin.ro, online`
      : SEO_DEFAULT.keywords,
    imageUrl: station?.thumbnail_url || SEO_DEFAULT.imageUrl,
    fullURL: station?.slug
      ? `${SITE_URL}/${station.slug}`
      : SEO_DEFAULT.fullURL,
  };
};

export const SEO_DEFAULT = {
  title: "Radio Creștin | Caută şi ascultă Radiouri Creştine online",
  description:
    "RadioCrestin.ro ⭐ iti ofera o lista de radiouri crestine online. Asculta un radio crestin bun si sanatos pentru sufletul tau la un simplu click!",
  keywords:
    "radio crestin, radiocrestin, radiouri crestine, radio crestin online, radiouri crestine online, radio crestine, radiocrestin.ro, online",
  imageUrl: "/images/android-chrome-512x512.png",
  fullURL: SITE_URL,
};

export const SEO_404 = {
  title: "Stația nu a fost găsită | Radio Creștin",
  description:
    "RadioCrestin.ro iti ofera o lista de radiouri crestine online. Asculta un radio crestin bun si sanatos pentru sufletul tau la un simplu click!",
  keywords:
    "radio crestin, radiocrestin, radiouri crestine, radio crestin online, radiouri crestine online, radio crestine, radiocrestin.ro, online",
  imageUrl: "/images/android-chrome-512x512.png",
  fullURL: SITE_URL,
};

export const seoInternalErrorPage = {
  title: `A apărut o eroare neașteptată`,
};

export const SEO_STATISTICI = {
  title: "Statistici | Radio Creștin",
  description: "Statistici ascultatori Radio Crestin.",
  keywords:
    "radio crestin, statistici, radiocrestin, radiouri crestine, radio crestin online, radiouri crestine online, radio crestine, radiocrestin.ro, online",
  imageUrl: "/images/android-chrome-512x512.png",
  fullURL: `${SITE_URL}/statistici`,
};

export const SEO_FAQ = {
  title: "Întrebări Frecvente (FAQ) | Radio Creștin",
  description:
    "Răspunsuri la cele mai frecvente întrebări despre Radio Creștin. Află cum să asculți radiouri creștine online, cum să adaugi o stație și multe altele.",
  keywords:
    "radio crestin faq, intrebari frecvente, ajutor radio crestin, radiocrestin, radiouri crestine, radio crestin online, radiocrestin.ro",
  imageUrl: "/images/android-chrome-512x512.png",
  fullURL: `${SITE_URL}/intrebari-frecvente`,
};
