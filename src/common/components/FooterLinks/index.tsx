import Link from "next/link";

import styles from "./styles.module.scss";

export default function FooterLinks() {
  return (
    <div className={styles.container}>
      <div className={styles.external_links}>
        <Link href="https://github.com/radio-crestin" target={"_blank"}>
          <img src="./icons/Github.png" alt="Github icon" />
        </Link>
        <Link
          href="https://graphql-viewer.radio-crestin.com/?endpoint=cc_BYFxAcGcC4HpYOYCcCG5gEcA2A6VATASwHsBaAYyQFNIRCA7Hc4gW1gDcBGRVdbIA&query=cc_I4VwpgTgngBA4mALgZUQQ0QSwPYDsDOMA3jPulnoSZgCYzYQ2QxaIA2YMA7mAEb6ZEnMAFs0mNqUQQwaEQH0QESQAcI2AB5R5ZGXMXKYACzb4d02QqWTERkCN65xbAzezoXbTGTC5IhJnwAYwhMFQpcGECQsIj5NCC41g4osGDQ8JxceS9cAGsYADNZRCUwHIw0xHkVbDIYWrJ8AAovEUEALhgARgAaekZIeV4oLpIVEF4vfCMwGi7omABfAEpiGFoWQRTojIiYXIKJqe9ZuiWYEEyRTmozK4PK3CDtEUIsG7I5FWWYXGwuDU2GgoJhcABzdabD5Vb6kPCQ6h0Jw3Fh2BxOCSuGBoCBYepIv5yTi2eyOZzYi5UmAyABumDAXCoGzoXwghE++DQ4M41K+cXB6iuzM2KM4DCYECkGCy8kQ2HMMrw8kF2GF635ss2EuY1IuQA&variables=cc_N4XyA"
          target={"_blank"}
        >
          <img src="./icons/GraphQLIcon.png" alt="GraphQLIcon icon" />
        </Link>
        <Link
          href="https://www.figma.com/file/iXXR3dhUjwfDDZH4FlEZgx/radio_crestin_com"
          target={"_blank"}
        >
          <img src="./icons/FigmaIcon2.png" alt="Figma icon" />
        </Link>
      </div>
    </div>
  );
}
