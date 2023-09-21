// TODO: Here should be the homepage.
import { getStations } from "@/services/getStations";
import { IStation } from "@/models/Station";
import StationsList from "@/components/StationsList";

export default function HomePage({ stations }: { stations: IStation[] }) {
  console.log("stations", stations[0])

  return (
    <>
      <StationsList stations={stations} />
    </>
  )
}

export const getStaticProps = (async () => {
  const { stations } = await getStations()

  return {
    props: {
      stations: stations,
    },
  }
})
