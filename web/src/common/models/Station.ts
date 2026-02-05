export interface IReview {
  id: number;
  station_id: number;
  stars: number;
  message: string;
  user_identifier?: string;
  created_at: string;
  updated_at: string;
  verified?: boolean;
}

export interface IReviewsStats {
  number_of_reviews: number;
  average_rating: number;
}

export interface IStation {
  id: number;
  slug: string;
  order: number;
  title: string;
  website: string;
  email: string;
  stream_url: string;
  proxy_stream_url: string;
  hls_stream_url: string;
  thumbnail_url: string;
  total_listeners: number;
  radio_crestin_listeners: number;
  description: string;
  description_action_title: string;
  description_link: string;
  feature_latest_post: boolean;
  facebook_page_id: string;
  posts: IPost[];
  uptime: IUptime;
  now_playing: INowPlaying;
  reviews_stats: IReviewsStats;
  is_favorite: boolean;
  station_streams: IStationStreams[];
}

export interface IStationStreams {
  type: "HLS" | "proxied_stream" | "direct_stream";
  stream_url: string;
  order?: number;
}

export interface IPost {
  id: number;
  title: string;
  description: string;
  link: string;
  published: string;
}

export interface IUptime {
  is_up: boolean;
  latency_ms: number;
  timestamp: string;
}

export interface INowPlaying {
  id: number;
  timestamp: string;
  song: ISong;
}

export interface ISong {
  id: number;
  name: string;
  thumbnail_url: string | null;
  artist: IArtist;
}

export interface IArtist {
  id: number;
  name: string;
  thumbnail_url: string | null;
}
