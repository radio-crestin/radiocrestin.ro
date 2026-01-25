export const SITE_URL = "https://www.radiocrestin.ro";
export const SHARE_URL = "https://share.radiocrestin.ro";

export const IOS_APP_ID = "6451270471";
export const ANDROID_PACKAGE = "com.radiocrestin.radio_crestin";

export const APP_RATING = "4.9";
export const APP_REVIEW_COUNT = "1800";

export const getIOSStoreLink = (source?: string) => {
  const baseUrl = `https://apps.apple.com/app/${IOS_APP_ID}`;
  return source ? `${baseUrl}?pt=126318767&ct=${source}&mt=8` : baseUrl;
};

export const getAndroidStoreLink = (source?: string) => {
  const baseUrl = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&hl=ro`;
  return source ? `${baseUrl}&utm_source=${source}` : baseUrl;
};

export const CONSTANTS = {
  DEFAULT_COVER: "",
  API_ENDPOINT: process.env.NEXT_PUBLIC_API_ENDPOINT || "https://api.radiocrestin.ro/api/v1/stations",
  GRAPHQL_ENDPOINT: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "https://api.radiocrestin.ro/v1/graphql",
};
