// TODO: Here should be the homepage.
import { getStations } from "@/common/frontendServices/getStations";
import { IStation } from "@/models/Station";

export default function HomePage({ stations }: { stations: IStation[] }) {
  console.log("stations", stations[0])

  return (
    <>
      {JSON.stringify(stations)}
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
