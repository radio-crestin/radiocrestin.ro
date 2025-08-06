export const getStations = async () => {
  try {
    // Round timestamp to seconds (remove milliseconds)
    const timestamp = Math.floor(Date.now() / 1000);
    const endpoint = `https://api.radiocrestin.ro/api/v1/stations?timestamp=${timestamp}`;

    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      stations: data.data.stations || [],
      station_groups: data.data.station_groups || [],
    };
  } catch (error) {
    console.error("Error fetching stations:", error);
    return { stations: [], station_groups: [] };
  }
};

