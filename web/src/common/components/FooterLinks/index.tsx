import Link from "next/link";

import styles from "./styles.module.scss";

export default function FooterLinks() {
  return (
    <div className={styles.container}>
      <Link href={"https://github.com/radio-crestin"} target="_blank">
        Github
      </Link>
      <Link href={"https://graphql-viewer.radio-crestin.com/"} target="_blank">
        GraphQL
      </Link>
      <Link
        href={
          "https://www.figma.com/file/iXXR3dhUjwfDDZH4FlEZgx/radio_crestin_com?type=design&node-id=0-1&mode=design&t=bDAT7O8QYisCX7ln-0"
        }
        target="_blank"
      >
        Figma
      </Link>
    </div>
  );
}
