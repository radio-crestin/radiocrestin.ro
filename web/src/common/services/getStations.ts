import { CONSTANTS } from "@/constants/constants";
import { IReview } from "@/models/Station";
import { Bugsnag } from "@/utils/bugsnag";
import fallbackData from "@/data/fallback-stations.json";

const API_BASE = "https://api.radiocrestin.ro/api/v1";

const getTimestamp = () => Math.floor(Date.now() / 1000);

const getFallbackStations = () => ({
  stations: fallbackData?.data?.stations || [],
  station_groups: fallbackData?.data?.station_groups || [],
});

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

    const stations = data?.data?.stations || [];
    if (stations.length === 0) {
      return getFallbackStations();
    }

    return {
      stations,
      station_groups: data?.data?.station_groups || [],
    };
  } catch (error) {
    Bugsnag.notify(
      new Error("Getting stations error: " + JSON.stringify(error, null, 2)),
    );

    return getFallbackStations();
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
