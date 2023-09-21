import Link from "next/link";
import { IStation } from "@/models/Station";

export default function StationsList({ stations }: { stations: IStation[] }) {
  return (
    <>
      {stations.map((station: IStation) => {
        return (
          <Link href={station.slug} key={`station-${station.slug}`}>
            <div key={station.id}>
              <h1>{station.title}</h1>
            </div>
          </Link>
        )
      })}
    </>
  )
}
