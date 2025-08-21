import React, { useContext } from "react";

import { Context } from "@/context/ContextProvider";

export default function WhatsAppButton() {
  const { ctx } = useContext(Context);
  return (
    <a
      href="https://wa.me/40766338046?text=Buna%20ziua%20[radiocrestin.ro]%0A"
      target="_blank"
      className={`text-foreground rounded-md text-center text-base px-3 py-1 flex items-center justify-center border border-foreground hover:opacity-70 md:right-4 ${
        ctx?.selectedStation ? "md:bottom-32" : ""
      }`}
      aria-label="Contact us on WhatsApp"
    >
      Contact
    </a>
  );
}
