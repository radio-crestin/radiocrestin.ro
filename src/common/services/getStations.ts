import { CONSTANTS } from "@/constants/constants";

const query = `
    query GetStations {
  stations(order_by: {order: asc}) {
    id
    order
    title
    website
    slug
    email
    stream_url
    proxy_stream_url
    hls_stream_url
    thumbnail_url
    total_listeners
    radio_crestin_listeners
    description
    uptime {
      is_up
      latency_ms
      timestamp
    }
    now_playing {
      id
      timestamp
      song {
        id
        name
        thumbnail_url
        artist {
          id
          name
          thumbnail_url
        }
      }
    }
    reviews {
      id
      stars
      message
    }
  }
}
`;

export const getStations = async () => {
  const endpoint = CONSTANTS.GRAPHQL_ENDPOINT;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      accept: "*/*",
    },
    body: JSON.stringify({ query }),
  })
    .then(async (response) => {
      return await response.json();
    })
    .catch((error) => {
      console.error("error", error);
    });

  return {
    stations: response?.data?.stations || [],
  };
};
