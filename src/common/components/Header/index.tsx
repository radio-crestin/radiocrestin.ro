import Link from "next/link";

import { IStation } from "@/models/Station";
import styles from "./styles.module.scss";
import LogoIcon from "@/icons/LogoIcon";

const Navigation = () => (
  <nav className={styles.nav}>
    <div className={styles.internal_links}>
      <Link href={"/"} className={styles.logo}>
        <LogoIcon width={50} height={50} />
      </Link>
      <Link href={"/despre-noi"}>Despre noi</Link>
      <Link href={"/despre-noi"}>Versetul zilei</Link>
      <Link href={"/despre-noi"}>Sugestii</Link>
    </div>
    <div className={styles.external_links}>
      <Link href="https://www.figma.com/file/iXXR3dhUjwfDDZH4FlEZgx/radio_crestin_com">
        <img src="./icons/FigmaIcon.png" alt="Figma icon" />
      </Link>
      <Link href="https://github.com/radio-crestin">
        <img src="./icons/Github.png" alt="Github icon" />
      </Link>
    </div>
  </nav>
);

const ContentLeft = ({ selectedStation }: { selectedStation: IStation }) => (
  <div className={styles.station}>
    <div className={styles.station_details}>
      <h1>{selectedStation.title}</h1>
      <p>{selectedStation.description}</p>
    </div>
  </div>
);
const ContentRight = () => <>ContentRight</>;

const Header = ({ selectedStation }: { selectedStation: IStation }) => {
  console.log("selectedStation", selectedStation);
  return (
    <header className={styles.container}>
      <Navigation />
      <div className={styles.content_section}>
        <ContentLeft selectedStation={selectedStation} />
        {/*<ContentRight />*/}
      </div>
    </header>
  );
};

export default Header;
