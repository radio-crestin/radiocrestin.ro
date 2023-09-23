// TODO: Here should be the homepage.
import { IStation } from "@/models/Station";
import StationList from "@/components/StationList/StationList";
import { getStations } from "@/common/services/getStations";
import { IStationGroup } from "@/models/StationGroup";
import { Flex } from "@chakra-ui/react";

export default function HomePage({ stations }: { stations: IStation[] }) {
  return (
    <Flex
      my={"50px"}
      justifyContent={"center"}>
      <StationList stations={stations} />
    </Flex>
  )
}

export const getStaticProps = (async () => {
  const { stations, station_groups } = await getStations()

  return {
    props: {
      stations: stations,
      station_groups: station_groups,
    },
  }
})
