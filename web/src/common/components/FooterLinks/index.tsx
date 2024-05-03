import Link from "next/link";

import styles from "./styles.module.scss";

export default function FooterLinks() {
  return (
    <div className={styles.container}>
      <Link href={"/statistici"}>Statistici</Link>
    </div>
  );
}
