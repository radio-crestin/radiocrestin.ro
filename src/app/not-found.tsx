import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "calc(100vh - 200px)",
          textAlign: "center",
          padding: "20px",
            color: "var(--text-color)",
        }}
      >
        <h1 style={{ fontSize: "48px", marginBottom: "20px", color: "var(--text-color)", }}>404</h1>
        <p style={{ fontSize: "18px", marginBottom: "30px", color: "var(--text-color)", }}>
          Pagina pe care o cauți nu a fost găsită.
        </p>
        <Link
          href="/"
          style={{
            color: "var(--primary-color)",
            textDecoration: "underline",
            fontSize: "16px",
          }}
        >
          Înapoi la pagina principală
        </Link>
      </div>
    </>
  );
}
