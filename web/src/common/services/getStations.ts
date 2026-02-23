import { CONSTANTS } from "@/constants/constants";
import { IReview, IStation } from "@/models/Station";
import { Bugsnag } from "@/utils/bugsnag";

const API_BASE = "https://api.radiocrestin.ro/api/v1";

const getTimestamp = () => Math.floor(Date.now() / 10000) * 10;

export type IStationMetadata = Partial<IStation> & { id: number };

export const getStations = async () => {
  try {
    const endpoint = `${CONSTANTS.API_ENDPOINT}?timestamp=${getTimestamp()}`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "*/*",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return {
      stations: data?.data?.stations || [],
      station_groups: data?.data?.station_groups || [],
    };
  } catch (error) {
    Bugsnag.notify(
      new Error("Getting stations error: " + JSON.stringify(error, null, 2)),
    );

    return {
      stations: [],
      station_groups: [],
    };
  }
};

export const getStationsMetadata = async (changesFromTimestamp?: number): Promise<IStationMetadata[]> => {
  try {
    let endpoint = `${API_BASE}/stations-metadata?timestamp=${getTimestamp()}`;
    if (changesFromTimestamp) {
      endpoint += `&changes_from_timestamp=${changesFromTimestamp}`;
    }

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "*/*",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data?.data?.stations_metadata || [];
  } catch (error) {
    Bugsnag.notify(
      new Error("Getting stations metadata error: " + JSON.stringify(error, null, 2)),
    );
    return [];
  }
};

export interface ISongHistoryItem {
  timestamp: string;
  listeners: number | null;
  song: {
    id: number;
    name: string;
    thumbnail_url: string | null;
    artist: {
      id: number;
      name: string;
      thumbnail_url: string | null;
    } | null;
  } | null;
}

export interface ISongHistoryResponse {
  station_id: number;
  station_slug: string;
  station_title: string;
  from_timestamp: number;
  to_timestamp: number;
  count: number;
  history: ISongHistoryItem[];
}

export const getStationSongHistory = async (
  stationSlug: string,
  fromTimestamp?: number,
  toTimestamp?: number,
): Promise<ISongHistoryResponse | null> => {
  try {
    let endpoint = `${API_BASE}/stations-metadata-history?station_slug=${encodeURIComponent(stationSlug)}`;
    if (fromTimestamp) {
      endpoint += `&from_timestamp=${fromTimestamp}`;
    }
    if (toTimestamp) {
      endpoint += `&to_timestamp=${toTimestamp}`;
    }

    const response = await fetch(endpoint, {
      method: "GET",
      headers: { accept: "*/*" },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data?.data?.stations_metadata_history || null;
  } catch (error) {
    Bugsnag.notify(
      new Error("Getting station song history error: " + JSON.stringify(error, null, 2)),
    );
    return null;
  }
};

export const getStationReviews = async (
  stationId: number,
): Promise<IReview[]> => {
  try {
    const endpoint = `${API_BASE}/reviews?station_id=${stationId}&timestamp=${getTimestamp()}`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "*/*",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data?.data?.reviews || [];
  } catch (error) {
    Bugsnag.notify(
      new Error(
        `Getting station reviews error: ${JSON.stringify(error, null, 2)}`,
      ),
    );
    return [];
  }
};
