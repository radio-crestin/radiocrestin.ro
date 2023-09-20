import styles from './page.module.scss'
import BannerApp from "@/components/BannerApp";
import React from "react";
import Image from "next/image";
import github_icon from "public/github-mark-white.svg"
import Link from "next/link";

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.description}>

      </div>
      <div className={styles.center}>
        <h1>Revenim în curând.</h1>
        <BannerApp />
      </div>

      <div>

        <div className={styles.grid}>
          <Link href={"https://github.com/radio-crestin/radiocrestin.ro"}>
            <Image src={github_icon} alt={"Github icon"} width={30} />
          </Link>
        </div>
      </div>
    </main>
  )
}
