import { IStation } from "@/models/Station";

export const seoStation = (station: IStation) => {
  return {
    title: `${station.title + ' · LIVE  ·'} Radio Crestin `,
    description: station?.title ? `Asculta ${station.title} live · ⭐ Lista de radiouri crestine · Radio Crestin Live` : SEO_DEFAULT.description,
    keywords: station?.title ? `${station.title}, ${station.title} live, ${station.title} online, radio crestin, radio-crestin.com, radiouri crestine romanesti, radio crestin online, muzica crestina, lista radio crestin, radio fm crestin` : SEO_DEFAULT.keywords,
    imageUrl: station?.thumbnail_url || SEO_DEFAULT.imageUrl,
    fullURL: station?.slug ? `https://radiocrestin.ro/${station.slug}` : `https://radiocrestin.ro/`,
  };
};

export const SEO_DEFAULT = {
  title: "Radio Crestin | Caută şi ascultă Radiouri Creştine online",
  description: "RadioCrestin.ro iti ofera o lista de radiouri crestine online. Asculta un radio crestin bun si sanatos pentru sufletul tau la un simplu click!",
  keywords: "radio crestin, radiocrestin, radiouri crestine, radio crestin online, radiouri crestine online, radio crestine, radiocrestin.ro, online",
  imageUrl: "/images/android-chrome-512x512.png"
}
export const seoNotFoundPage = {
  title: `Stația nu a fost găsită`,
};

export const seoInternalErrorPage = {
  title: `A apărut o eroare neașteptată`,
};

export const seoPrivacyPolicy = {
  title: `Politica de confidențialitate`,
  description: `Politica de confidențialitate a site-ului Radio-Crestin.com`,
  keywords: ``,
};
