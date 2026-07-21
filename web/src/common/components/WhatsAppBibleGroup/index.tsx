import React, { useEffect, useState } from "react";
import styles from "./styles.module.scss";

const DISMISSED_KEY = "whatsapp-verse-dismissed";
const TIME_KEY = "whatsapp-verse-seconds";
const SHOW_AFTER_SECONDS = 5 * 60;
const TICK_MS = 15000;

export default function WhatsAppBibleGroup() {
  // Time-on-site gate: accumulate seconds across visits; once past the
  // threshold mid-session, reveal on the next tap/keypress so the layout
  // shift stays input-adjacent (excluded from CLS) instead of a timer pop-in.
  // Already-eligible visitors get `data-wa-verse-show` pre-paint (BaseLayout).
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    if (
      localStorage.getItem(DISMISSED_KEY) ||
      html.hasAttribute("data-wa-verse-show")
    ) {
      return;
    }

    const reveal = () => {
      setRevealed(true);
      html.setAttribute("data-wa-verse-show", "1");
    };
    const armReveal = () => {
      window.addEventListener("pointerdown", reveal, { once: true });
      window.addEventListener("keydown", reveal, { once: true });
    };

    let last = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now();
      // Cap the delta so sleep/suspend gaps don't count as time on site
      const delta = Math.min(Math.round((now - last) / 1000), 120);
      last = now;
      const total = (parseInt(localStorage.getItem(TIME_KEY) || "0", 10) || 0) + delta;
      localStorage.setItem(TIME_KEY, String(total));
      if (total >= SHOW_AFTER_SECONDS) {
        window.clearInterval(interval);
        armReveal();
      }
    }, TICK_MS);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pointerdown", reveal);
      window.removeEventListener("keydown", reveal);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    document.documentElement.setAttribute("data-wa-verse-hidden", "1");
  };

  return (
    <div
      className={
        revealed ? `${styles.container} ${styles.reveal}` : styles.container
      }
    >
      <a
        className={styles.link}
        href="https://chat.whatsapp.com/I78qjRg1RaI5UKTvEwZdNm"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className={styles.icon}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 360 362"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M307.546 52.5655C273.709 18.685 228.706 0.0171895 180.756 0C81.951 0 1.53846 80.404 1.50408 179.235C1.48689 210.829 9.74646 241.667 25.4319 268.844L0 361.736L95.0236 336.811C121.203 351.096 150.683 358.616 180.679 358.625H180.756C279.544 358.625 359.966 278.212 360 179.381C360.017 131.483 341.392 86.4547 307.546 52.5741V52.5655ZM180.756 328.354H180.696C153.966 328.346 127.744 321.16 104.865 307.589L99.4242 304.358L43.034 319.149L58.0834 264.168L54.5423 258.53C39.6304 234.809 31.749 207.391 31.7662 179.244C31.8006 97.1036 98.6334 30.2707 180.817 30.2707C220.61 30.2879 258.015 45.8015 286.145 73.9665C314.276 102.123 329.755 139.562 329.738 179.364C329.703 261.513 262.871 328.346 180.756 328.346V328.354ZM262.475 216.777C257.997 214.534 235.978 203.704 231.869 202.209C227.761 200.713 224.779 199.966 221.796 204.452C218.814 208.939 210.228 219.029 207.615 222.011C205.002 225.002 202.389 225.372 197.911 223.128C193.434 220.885 179.003 216.158 161.891 200.902C148.578 189.024 139.587 174.362 136.975 169.875C134.362 165.389 136.7 162.965 138.934 160.739C140.945 158.728 143.412 155.505 145.655 152.892C147.899 150.279 148.638 148.406 150.133 145.423C151.629 142.432 150.881 139.82 149.764 137.576C148.646 135.333 139.691 113.287 135.952 104.323C132.316 95.5909 128.621 96.777 125.879 96.6309C123.266 96.5019 120.284 96.4762 117.293 96.4762C114.302 96.4762 109.454 97.5935 105.346 102.08C101.238 106.566 89.6691 117.404 89.6691 139.441C89.6691 161.478 105.716 182.785 107.959 185.776C110.202 188.767 139.544 234.001 184.469 253.408C195.153 258.023 203.498 260.782 210.004 262.845C220.731 266.257 230.494 265.776 238.212 264.624C246.816 263.335 264.71 253.786 268.44 243.326C272.17 232.866 272.17 223.893 271.053 222.028C269.936 220.163 266.945 219.037 262.467 216.794L262.475 216.777Z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span className={styles.text}>
          <span className={styles.title}>Versetul Zilei</span>
          <span className={styles.cta}>
            Primește-l zilnic{" "}
            <span className={styles.ctaEnd}>
              pe WhatsApp
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M3 1.5L6.5 5L3 8.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </span>
        </span>
      </a>
      <button
        className={styles.close}
        onClick={dismiss}
        aria-label="Închide"
        type="button"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M1.5 1.5L12.5 12.5M12.5 1.5L1.5 12.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
