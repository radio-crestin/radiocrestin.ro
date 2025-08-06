export const GET_STATIONS_QUERY_STRING = `
  query GetStations {
  stations(order_by: {order: asc, title: asc}){
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
    description_action_title
    description_link
    feature_latest_post
    station_streams {
      type
      stream_url
      order
    }
    posts(limit: 1, order_by: {published: desc}) {
      id
      title
      description
      link
      published
    }
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
  station_groups {
    id
    name
    order
    station_to_station_groups {
      station_id
      order
    }
  }
}
`;
