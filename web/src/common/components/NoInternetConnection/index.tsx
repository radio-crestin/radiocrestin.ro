import { useEffect, useState } from "react";
import styles from "./styles.module.scss";

export default function NoInternetConnection({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  return (
    <div className={styles.container}>
      {children}
      {!isOnline && (
        <div className={styles.overlay}>
          <div className={styles.card} role="alert" aria-live="assertive">
            <div className={styles.icon_badge}>
              <span className={styles.ring} />
              <span className={`${styles.ring} ${styles.ring_delayed}`} />
              <svg
                width="38"
                height="38"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="2" y1="2" x2="22" y2="22" />
                <path d="M8.5 16.5a5 5 0 0 1 7 0" />
                <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
                <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" />
                <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" />
                <path d="M5 13a10 10 0 0 1 5.24-2.76" />
                <line x1="12" y1="20" x2="12.01" y2="20" />
              </svg>
            </div>
            <h2>Fără conexiune la internet</h2>
            <p>
              Verifică rețeaua Wi-Fi sau datele mobile. Redarea va continua
              automat imediat ce conexiunea revine.
            </p>
            <div className={styles.status}>
              <span className={styles.status_dot} />
              Se așteaptă reconectarea…
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
