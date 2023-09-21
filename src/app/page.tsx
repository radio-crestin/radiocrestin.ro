// TODO: Here should be the homepage.
import { getStations } from "@/common/frontendServices/getStations";
import { IStation } from "@/models/Station";
import StationList from "@/components/StationList/StationList";

export default async function HomePage() {
  const { stations, station_groups } = await getStations()

  return (
    <>
      <StationList stations={stations} station_group={station_groups[0]} />
    </>
  )
}
