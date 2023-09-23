// TODO: Here should be the homepage.
import { IStation } from "@/models/Station";
import StationList from "@/components/StationList/StationList";
import { getStations } from "@/common/services/getStations";
import { Flex } from "@chakra-ui/react";
import { cleanStationsMetadata } from "@/utils/cleanStationsMetadata";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { SEO_HOMEPAGE } from "@/constants";

export default function HomePage({ stations_BE }: { stations_BE: IStation[] }) {
  const [stations, setStations] = useState<IStation[]>(stations_BE);

  useEffect(() => {
    const fetchStationsData = async () => {
      try {
        const data = await getStations();
        if (data?.stations && data?.stations.length > 0) {
          setStations(data.stations);
        }
      } catch (error) {
        console.error("Failed to fetch stations:", error);
      }
    };
    fetchStationsData();
    const intervalId = setInterval(fetchStationsData, 10000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <Layout {...SEO_HOMEPAGE}>
      <Flex
        my={"50px"}
        justifyContent={"center"}>
        <StationList stations={stations} />
      </Flex>
    </Layout>
  )
}

export const getStaticProps = (async () => {
  const { stations } = await getStations()

  const stations_without_meta = cleanStationsMetadata(stations);

  return {
    props: {
      stations_BE: stations_without_meta,
    },
  }
})
