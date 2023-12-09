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
  description: string;
  description_action_title: string;
  description_link: string;
  feature_latest_post: boolean;
  facebook_page_id: string;
  posts: IPost[];
  uptime: IUptime;
  now_playing: INowPlaying;
  reviews: any[];
  is_favorite: boolean;
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
