import React, { useContext } from "react";

import { IStation } from "@/models/Station";
import { Context } from "@/context/ContextProvider";


export default function ShareOnSocial() {
  const { ctx } = useContext(Context);
  const station = ctx?.selectedStation as IStation;
  if(!station) return null;
  const url = `https://share.radiocrestin.ro/${station.slug}`
  const message = `Ascultă și tu ${station.title}: \n${url}`
  const facebookShareLink =  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(message)}`;
  const whatsappShareLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  return (
      <div className="flex gap-3 flex-col md:flex-row">
        <a href={facebookShareLink} target="_blank" className="flex items-center px-5 py-3 bg-blue-600 text-white rounded-lg font-semibold transition-opacity hover:opacity-90">
            <img src="./icons/facebook.svg" alt="Trimite pe Facebook" className="w-5 h-5 mr-2" />
            Trimite pe Facebook
        </a>
        <a href={whatsappShareLink} target="_blank" className="flex items-center px-5 py-3 bg-green-500 text-white rounded-lg font-semibold transition-opacity hover:opacity-90">
          <img src="./icons/whatsapp.svg" alt="Trimite pe Whatsapp" className="w-5 h-5 mr-2" />
          Trimite pe WhatsApp
        </a>
      </div>

);
}
