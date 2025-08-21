import { CONSTANTS } from "@/constants/constants";
import { Bugsnag } from "@/utils/bugsnag";

export const getStations = async () => {
  try {
    // Round timestamp to seconds (remove milliseconds)
    const timestamp = Math.floor(Date.now() / 1000);
    const endpoint = `${CONSTANTS.API_ENDPOINT}?timestamp=${timestamp}`;

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
