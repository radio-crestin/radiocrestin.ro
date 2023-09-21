export const getStations = async () => {
  const response = await fetch('https://www.radio-crestin.com/api/v1/stations').then(async (response) => {
    return await response.json();
  })

  return {
    stations: response.stations,
    station_groups: response.station_groups
  }
};
