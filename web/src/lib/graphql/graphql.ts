/* eslint-disable */
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** Date with time (isoformat) */
  DateTime: { input: any; output: any; }
  /** The `JSON` scalar type represents JSON values as specified by [ECMA-404](https://ecma-international.org/wp-content/uploads/ECMA-404_2nd_edition_december_2017.pdf). */
  JSON: { input: any; output: any; }
};

export type ArtistType = {
  __typename?: 'ArtistType';
  created_at: Scalars['DateTime']['output'];
  dirty_metadata: Scalars['Boolean']['output'];
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  thumbnail?: Maybe<DjangoImageType>;
  thumbnail_url?: Maybe<Scalars['String']['output']>;
  updated_at: Scalars['DateTime']['output'];
};

export type DjangoImageType = {
  __typename?: 'DjangoImageType';
  height: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  path: Scalars['String']['output'];
  size: Scalars['Int']['output'];
  url: Scalars['String']['output'];
  width: Scalars['Int']['output'];
};

export type DjangoModelType = {
  __typename?: 'DjangoModelType';
  pk: Scalars['ID']['output'];
};

export type ListeningEventInput = {
  anonymous_session_id: Scalars['String']['input'];
  bytes_transferred: Scalars['Int']['input'];
  event_type: Scalars['String']['input'];
  ip_address: Scalars['String']['input'];
  request_count?: InputMaybe<Scalars['Int']['input']>;
  request_duration: Scalars['Float']['input'];
  station_slug: Scalars['String']['input'];
  status_code: Scalars['Int']['input'];
  timestamp: Scalars['String']['input'];
  user_agent: Scalars['String']['input'];
};

export type OperationInfo = {
  __typename?: 'OperationInfo';
  /** List of messages returned by the operation. */
  messages: Array<OperationMessage>;
};

export type OperationMessage = {
  __typename?: 'OperationMessage';
  /** The error code, or `null` if no error code was set. */
  code?: Maybe<Scalars['String']['output']>;
  /** The field that caused the error, or `null` if it isn't associated with any particular field. */
  field?: Maybe<Scalars['String']['output']>;
  /** The kind of this message. */
  kind: OperationMessageKind;
  /** The error message. */
  message: Scalars['String']['output'];
};

export enum OperationMessageKind {
  Error = 'ERROR',
  Info = 'INFO',
  Permission = 'PERMISSION',
  Validation = 'VALIDATION',
  Warning = 'WARNING'
}

export enum OrderDirection {
  Asc = 'asc',
  Desc = 'desc'
}

export type PostOrderBy = {
  published?: InputMaybe<OrderDirection>;
};

export type PostType = {
  __typename?: 'PostType';
  created_at: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  link: Scalars['String']['output'];
  published: Scalars['DateTime']['output'];
  station: DjangoModelType;
  station_id: Scalars['Int']['output'];
  title: Scalars['String']['output'];
  updated_at: Scalars['DateTime']['output'];
};

export type ReviewType = {
  __typename?: 'ReviewType';
  id: Scalars['Int']['output'];
  message: Scalars['String']['output'];
  stars: Scalars['Int']['output'];
};

export type SongType = {
  __typename?: 'SongType';
  artist?: Maybe<ArtistType>;
  artist_id?: Maybe<Scalars['Int']['output']>;
  created_at: Scalars['DateTime']['output'];
  dirty_metadata: Scalars['Boolean']['output'];
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  thumbnail?: Maybe<DjangoImageType>;
  thumbnail_url?: Maybe<Scalars['String']['output']>;
  updated_at: Scalars['DateTime']['output'];
};

export type StationGroupType = {
  __typename?: 'StationGroupType';
  created_at: Scalars['DateTime']['output'];
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  order: Scalars['Float']['output'];
  slug: Scalars['String']['output'];
  station_to_station_groups: Array<StationToStationGroupType>;
  updated_at: Scalars['DateTime']['output'];
};

export type StationNowPlayingType = {
  __typename?: 'StationNowPlayingType';
  created_at: Scalars['DateTime']['output'];
  error?: Maybe<Scalars['JSON']['output']>;
  id: Scalars['Int']['output'];
  listeners?: Maybe<Scalars['Int']['output']>;
  raw_data: Scalars['JSON']['output'];
  song?: Maybe<SongType>;
  song_id?: Maybe<Scalars['Int']['output']>;
  station: DjangoModelType;
  station_id: Scalars['Int']['output'];
  timestamp: Scalars['DateTime']['output'];
  updated_at: Scalars['DateTime']['output'];
};

export type StationOrderBy = {
  order?: InputMaybe<OrderDirection>;
  title?: InputMaybe<OrderDirection>;
};

export type StationStreamType = {
  __typename?: 'StationStreamType';
  created_at: Scalars['DateTime']['output'];
  id: Scalars['Int']['output'];
  order?: Maybe<Scalars['Float']['output']>;
  station: DjangoModelType;
  station_id: Scalars['Int']['output'];
  stream_url: Scalars['String']['output'];
  type: Scalars['String']['output'];
  updated_at: Scalars['DateTime']['output'];
};

export type StationToStationGroupType = {
  __typename?: 'StationToStationGroupType';
  created_at: Scalars['DateTime']['output'];
  group: DjangoModelType;
  group_id: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  order?: Maybe<Scalars['Float']['output']>;
  station: DjangoModelType;
  station_id: Scalars['Int']['output'];
  updated_at: Scalars['DateTime']['output'];
};

export type StationType = {
  __typename?: 'StationType';
  check_uptime: Scalars['Boolean']['output'];
  created_at: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  description_action_title?: Maybe<Scalars['String']['output']>;
  description_link?: Maybe<Scalars['String']['output']>;
  disabled: Scalars['Boolean']['output'];
  email?: Maybe<Scalars['String']['output']>;
  facebook_page_id?: Maybe<Scalars['String']['output']>;
  feature_latest_post: Scalars['Boolean']['output'];
  generate_hls_stream: Scalars['Boolean']['output'];
  hls_stream_url?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  latest_station_now_playing?: Maybe<DjangoModelType>;
  latest_station_now_playing_id?: Maybe<Scalars['Int']['output']>;
  latest_station_uptime?: Maybe<DjangoModelType>;
  latest_station_uptime_id?: Maybe<Scalars['Int']['output']>;
  now_playing?: Maybe<StationNowPlayingType>;
  order: Scalars['Float']['output'];
  posts: Array<PostType>;
  proxy_stream_url?: Maybe<Scalars['String']['output']>;
  radio_crestin_listeners?: Maybe<Scalars['Int']['output']>;
  reviews: Array<ReviewType>;
  rss_feed?: Maybe<Scalars['String']['output']>;
  slug: Scalars['String']['output'];
  station_streams: Array<StationStreamType>;
  stream_url: Scalars['String']['output'];
  thumbnail?: Maybe<DjangoImageType>;
  thumbnail_url?: Maybe<Scalars['String']['output']>;
  title: Scalars['String']['output'];
  total_listeners?: Maybe<Scalars['Int']['output']>;
  updated_at: Scalars['DateTime']['output'];
  uptime?: Maybe<StationUptimeType>;
  website: Scalars['String']['output'];
};


export type StationTypePostsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<PostOrderBy>;
};

export type StationUptimeType = {
  __typename?: 'StationUptimeType';
  created_at: Scalars['DateTime']['output'];
  id: Scalars['Int']['output'];
  is_up: Scalars['Boolean']['output'];
  latency_ms?: Maybe<Scalars['Int']['output']>;
  raw_data: Scalars['JSON']['output'];
  station: DjangoModelType;
  station_id: Scalars['Int']['output'];
  timestamp: Scalars['DateTime']['output'];
  updated_at: Scalars['DateTime']['output'];
};

export type SubmitListeningEventsPayload = OperationInfo | SubmitListeningEventsResponse;

export type SubmitListeningEventsResponse = {
  __typename?: 'SubmitListeningEventsResponse';
  message: Scalars['String']['output'];
  processed_count: Scalars['Int']['output'];
  success: Scalars['Boolean']['output'];
};

export type TriggerMetadataFetchPayload = OperationInfo | TriggerMetadataFetchResponse;

export type TriggerMetadataFetchResponse = {
  __typename?: 'TriggerMetadataFetchResponse';
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export type UserType = {
  __typename?: 'UserType';
  address?: Maybe<Scalars['String']['output']>;
  anonymous_id?: Maybe<Scalars['String']['output']>;
  anonymous_id_verified?: Maybe<Scalars['DateTime']['output']>;
  checkout_phone_number?: Maybe<Scalars['String']['output']>;
  created_at: Scalars['DateTime']['output'];
  date_joined: Scalars['DateTime']['output'];
  email?: Maybe<Scalars['String']['output']>;
  email_verified?: Maybe<Scalars['DateTime']['output']>;
  first_name: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  is_active: Scalars['Boolean']['output'];
  is_anonymous: Scalars['Boolean']['output'];
  is_staff: Scalars['Boolean']['output'];
  is_superuser: Scalars['Boolean']['output'];
  last_login?: Maybe<Scalars['DateTime']['output']>;
  last_name: Scalars['String']['output'];
  modified_at: Scalars['DateTime']['output'];
  password: Scalars['String']['output'];
  phone_number?: Maybe<Scalars['String']['output']>;
  phone_number_verified?: Maybe<Scalars['DateTime']['output']>;
  phone_verified?: Maybe<Scalars['DateTime']['output']>;
  photo_url?: Maybe<Scalars['String']['output']>;
};

export type MutationRoot = {
  __typename?: 'mutationRoot';
  check_health: Scalars['String']['output'];
  health_check: Scalars['String']['output'];
  submit_listening_events: SubmitListeningEventsPayload;
  trigger_metadata_fetch: TriggerMetadataFetchPayload;
};


export type MutationRootSubmit_Listening_EventsArgs = {
  events: Array<ListeningEventInput>;
};


export type MutationRootTrigger_Metadata_FetchArgs = {
  station_id: Scalars['Int']['input'];
};

export type QueryRoot = {
  __typename?: 'queryRoot';
  artists: Array<ArtistType>;
  artists_by_pk?: Maybe<ArtistType>;
  autocomplete: Array<Scalars['JSON']['output']>;
  current_time: Scalars['String']['output'];
  /** Get the currently authenticated user, or null if anonymous */
  current_user?: Maybe<UserType>;
  health: Scalars['Boolean']['output'];
  posts: Array<PostType>;
  posts_by_pk?: Maybe<PostType>;
  songs: Array<SongType>;
  songs_by_pk?: Maybe<SongType>;
  station_groups: Array<StationGroupType>;
  stations: Array<StationType>;
  stations_by_pk?: Maybe<StationType>;
};


export type QueryRootArtistsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};


export type QueryRootArtists_By_PkArgs = {
  id: Scalars['Int']['input'];
};


export type QueryRootAutocompleteArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
  search_type?: InputMaybe<Scalars['String']['input']>;
};


export type QueryRootPostsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryRootPosts_By_PkArgs = {
  id: Scalars['Int']['input'];
};


export type QueryRootSongsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};


export type QueryRootSongs_By_PkArgs = {
  id: Scalars['Int']['input'];
};


export type QueryRootStation_GroupsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<StationOrderBy>;
};


export type QueryRootStationsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<StationOrderBy>;
};


export type QueryRootStations_By_PkArgs = {
  id: Scalars['Int']['input'];
};
