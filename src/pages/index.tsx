import styles from "./styles.module.scss";
import { useEffect } from "react";

export default function Home() {
  // TODO: Temporary redirect to radio-gosen - remove this when the new website is ready
  useEffect(() => {
    window.location.href = "/radio-gosen";
  }, []);

  return <main className={styles.main}></main>;
}
