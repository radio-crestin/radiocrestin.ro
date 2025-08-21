"use client";

import Link from "next/link";

import { IStation } from "@/models/Station";
import HeadphoneIcon from "@/icons/Headphone";
import Heart from "@/icons/Heart";
import useFavourite from "@/store/useFavourite";
import { useContext, useEffect, useState } from "react";
import { Context } from "@/context/ContextProvider";

const StationItem = (data: IStation) => {
  const { ctx } = useContext(Context);
  const { favouriteItems, toggleFavourite } = useFavourite();
  const [isStationFavourite, setIsStationFavourite] = useState(false);
  const isActive = ctx.selectedStation?.slug === data.slug;
  useEffect(() => {
    setIsStationFavourite(favouriteItems.includes(data.slug));
  }, [data.slug, favouriteItems]);

  return (
    <Link
      className={`flex items-center justify-start gap-6 w-full max-w-xl max-h-36 px-4 py-4 rounded-2xl shadow-md relative z-[1] hover:scale-[1.02] transition-transform xl:max-w-[45%] lg:max-w-none lg:mx-6 md:mx-4 pointer-coarse:hover:scale-100 ${isActive ? 'bg-background-active' : 'bg-background-card'}`}
      data-station={"station-item"}
      data-active={isActive}
      href={data.slug}
      scroll={false}
      draggable={false}
    >
      <div>
        <img
          src={data.now_playing?.song?.thumbnail_url || data?.thumbnail_url}
          alt={`${data.title} | radiocrestin.ro`}
          loading={"lazy"}
          height={110}
          width={110}
          className="rounded-2xl object-cover md:h-16 md:w-16"
          onError={(e) => {
            e.currentTarget.src = '/images/radio-crestin-default-logo.png';
          }}
        />
      </div>
      <div className="flex justify-center flex-col mr-7">
        <p className="font-DMSans_Bold text-xl font-bold mb-1 md:text-lg text-foreground">{data.title}</p>
        <p className="text-sm font-normal mt-0.5 leading-4 line-clamp-2 md:text-xs text-foreground-muted">
          {data?.now_playing?.song?.name}
          {data?.now_playing?.song?.artist?.name && (
            <span className="text-sm font-normal mt-0.5 leading-4 md:text-xs text-foreground-muted">
              {" · "}
              {data?.now_playing?.song?.artist?.name}
            </span>
          )}
        </p>
      </div>
      {data.total_listeners > 0 && (
        <div className="absolute top-4 right-4 text-base font-normal md:text-sm text-foreground md:[&_svg]:relative md:[&_svg]:top-1 md:[&_svg]:w-4">
          {data?.total_listeners} <HeadphoneIcon />
        </div>
      )}
      <div
        className="absolute bottom-2.5 right-2.5 text-base font-normal cursor-pointer p-1 rounded-full hover:scale-150 transition-transform"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleFavourite(data.slug);
        }}
      >
        <Heart color={isStationFavourite ? "red" : "white"} />
      </div>
    </Link>
  );
};

export default StationItem;
