import { IStation } from "@/common/models/Station";

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
      ? `https://radiocrestin.ro/${station.slug}`
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
  fullURL: "https://radiocrestin.ro/",
  canonical: "https://radiocrestin.ro/",
  author: {
    name: "Radio Creștin",
    url: "https://radiocrestin.ro",
  },
  openGraph: {
    title: "Radio Creștin | Caută şi ascultă Radiouri Creştine online",
    description:
      "RadioCrestin.ro ⭐ iti ofera o lista de radiouri crestine online. Asculta un radio crestin bun si sanatos pentru sufletul tau la un simplu click!",
    url: "https://radiocrestin.ro/",
    site_name: "Radio Creștin",
    images: [
      {
        url: "https://radiocrestin.ro/images/android-chrome-512x512.png",
        width: 1200,
        height: 630,
        alt: "Radio Creștin",
      },
    ],
    locale: "ro_RO",
  },
  twitter: {
    title: "Radio Creștin | Caută şi ascultă Radiouri Creştine online",
    description:
      "RadioCrestin.ro ⭐ iti ofera o lista de radiouri crestine online. Asculta un radio crestin bun si sanatos pentru sufletul tau la un simplu click!",
    images: ["https://radiocrestin.ro/images/android-chrome-512x512.png"],
  },
};

export const SEO_404 = {
  title: "Stația nu a fost găsită | Radio Creștin",
  description:
    "RadioCrestin.ro iti ofera o lista de radiouri crestine online. Asculta un radio crestin bun si sanatos pentru sufletul tau la un simplu click!",
  keywords:
    "radio crestin, radiocrestin, radiouri crestine, radio crestin online, radiouri crestine online, radio crestine, radiocrestin.ro, online",
  imageUrl: "/images/android-chrome-512x512.png",
  fullURL: "https://radiocrestin.ro/",
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
  fullURL: "https://radiocrestin.ro/statistici",
  canonical: "https://radiocrestin.ro/statistici",
  author: {
    name: "Radio Creștin",
    url: "https://radiocrestin.ro",
  },
  openGraph: {
    title: "Statistici | Radio Creștin",
    description: "Statistici ascultatori Radio Crestin.",
    url: "https://radiocrestin.ro/statistici",
    site_name: "Radio Creștin",
    images: [
      {
        url: "https://radiocrestin.ro/images/android-chrome-512x512.png",
        width: 1200,
        height: 630,
        alt: "Radio Creștin Statistici",
      },
    ],
    locale: "ro_RO",
  },
  twitter: {
    title: "Statistici | Radio Creștin",
    description: "Statistici ascultatori Radio Crestin.",
    images: ["https://radiocrestin.ro/images/android-chrome-512x512.png"],
  },
};
