import { CONSTANTS } from "@/constants/constants";
import type { IReview, IStation } from "@/models/Station";
import { captureException } from "@/utils/posthog";
import {
  API_BASE,
  isTransient,
  isTransientHttpStatus,
  parseJsonOrThrowTransient,
  timeoutSignal,
} from "@/services/http";

export { isTransientHttpStatus };

const getTimestamp = () => Math.floor(Date.now() / 10000) * 10;

export type IStationMetadata = Partial<IStation> & { id: number };

// Imported on demand so the ~120KB backup dataset stays out of the eager client
// bundle — it's only needed when the API is unreachable. If the chunk itself
// can't load either (fully offline), degrade to empty data instead of throwing,
// so the catch-block call sites can't reject.
const getFallbackStations = async () => {
  try {
    const { default: fallbackData } = await import(
      "@/data/fallback-stations.json"
    );
    return {
      stations: fallbackData?.data?.stations || [],
      station_groups: fallbackData?.data?.station_groups || [],
    };
  } catch {
    return { stations: [], station_groups: [] };
  }
};

export const getStations = async () => {
  const endpoint = `${CONSTANTS.API_ENDPOINT}?timestamp=${getTimestamp()}`;
  const isClient = typeof window !== "undefined";
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "*/*",
      },
      signal: timeoutSignal(isClient ? 5000 : 2000),
    });

    if (!response.ok) {
      if (isTransientHttpStatus(response.status)) {
        return getFallbackStations();
      }
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(`HTTP ${response.status} from ${endpoint}: ${body}`);
    }

    const data = await parseJsonOrThrowTransient(response);

    const stations = data?.data?.stations || [];
    if (stations.length === 0) {
      return getFallbackStations();
    }

    return {
      stations,
      station_groups: data?.data?.station_groups || [],
    };
  } catch (error) {
    if (!isTransient(error)) {
      captureException(error, `getStations failed [${endpoint}]`);
    }
    return getFallbackStations();
  }
};

export const getStationsMetadata = async (
  changesFromTimestamp?: number,
  explicitTimestamp?: number,
): Promise<IStationMetadata[]> => {
  const ts = explicitTimestamp ?? getTimestamp();
  let endpoint = `${API_BASE}/stations-metadata?timestamp=${ts}`;
  if (changesFromTimestamp) {
    endpoint += `&changes_from_timestamp=${changesFromTimestamp}`;
  }
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "*/*",
      },
    });

    if (!response.ok) {
      // 400 usually means client clock is skewed — skip silently
      if (response.status === 400) return [];
      if (isTransientHttpStatus(response.status)) return [];
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(`HTTP ${response.status} from ${endpoint}: ${body}`);
    }

    const data = await parseJsonOrThrowTransient(response);
    return data?.data?.stations_metadata || [];
  } catch (error) {
    if (!isTransient(error)) {
      captureException(error, `getStationsMetadata failed [${endpoint}]`);
    }
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
  let endpoint = `${API_BASE}/stations-metadata-history?station_slug=${encodeURIComponent(stationSlug)}`;
  if (fromTimestamp) {
    endpoint += `&from_timestamp=${fromTimestamp}`;
  }
  if (toTimestamp) {
    endpoint += `&to_timestamp=${toTimestamp}`;
  }
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { accept: "*/*" },
    });

    if (!response.ok) {
      if (isTransientHttpStatus(response.status)) return null;
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(`HTTP ${response.status} from ${endpoint}: ${body}`);
    }

    const data = await parseJsonOrThrowTransient(response);
    return data?.data?.stations_metadata_history || null;
  } catch (error) {
    if (!isTransient(error)) {
      captureException(error, `getStationSongHistory failed [${stationSlug}]`);
    }
    return null;
  }
};

export const getStationReviews = async (
  stationId: number,
): Promise<IReview[]> => {
  // Station ids start at 0 (aripi-spre-cer IS station 0), so only negative /
  // NaN ids are invalid and skip the request.
  if (!Number.isFinite(stationId) || stationId < 0) return [];
  const endpoint = `${API_BASE}/reviews?station_id=${stationId}&timestamp=${getTimestamp()}`;
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "*/*",
      },
      signal: timeoutSignal(3000),
    });

    if (!response.ok) {
      if (isTransientHttpStatus(response.status)) return [];
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(`HTTP ${response.status} from ${endpoint}: ${body}`);
    }

    const data = await parseJsonOrThrowTransient(response);
    return data?.data?.reviews || [];
  } catch (error) {
    if (!isTransient(error)) {
      captureException(error, `getStationReviews failed [stationId=${stationId}]`);
    }
    return [];
  }
};
