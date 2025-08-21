"use client";

import Link from "next/link";

import { IStation } from "@/models/Station";
import useFavourite from "@/store/useFavourite";
import React, { useContext, useEffect, useState } from "react";
import Heart from "@/icons/Heart";
import { Context } from "@/context/ContextProvider";

const FavouriteItem = (data: IStation) => {
  const { ctx } = useContext(Context);
  const { favouriteItems, toggleFavourite } = useFavourite();
  const [isStationFavourite, setIsStationFavourite] = useState(false);
  const isActive = ctx.selectedStation?.slug === data.slug;

  useEffect(() => {
    setIsStationFavourite(favouriteItems.includes(data.slug));
  }, [data.slug, favouriteItems]);

  return (
    <Link
      className={`flex items-end justify-between p-4 w-[29%] h-fit rounded-2xl shadow-md hover:scale-[1.02] transition-transform lg:w-[45%] sm:w-full ${isActive ? 'bg-background-active' : 'bg-background-card'}`}
      href={data.slug}
      scroll={false}
      data-active={isActive}
      draggable={false}
    >
      <div className="flex items-center justify-center gap-2.5">
        <img
          src={data.thumbnail_url}
          alt={`${data.title} | radiocrestin.ro`}
          loading={"lazy"}
          height={100}
          width={100}
          className="rounded-lg object-cover h-[100px] w-[100px]"
          onError={(e) => {
            e.currentTarget.src = '/images/radio-crestin-default-logo.png';
          }}
        />
        <div>
          <p className="font-bold text-xl font-medium mb-1 text-foreground md:text-lg">{data.title}</p>
          <p className="text-sm font-normal mt-0.5 text-foreground-muted leading-4 line-clamp-2 md:text-xs">
            {data?.now_playing?.song?.name}
            {data?.now_playing?.song?.artist?.name && (
              <span className="text-sm font-normal mt-0.5 text-foreground-muted leading-4 md:text-xs">
                {" · "}
                {data?.now_playing?.song?.artist?.name}
              </span>
            )}
          </p>
        </div>
      </div>
      <div
        className="text-lg font-normal cursor-pointer p-1 pb-0.5 rounded-full hover:scale-150 transition-transform"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleFavourite(data.slug);
        }}
      >
        <Heart color={"red"} />
      </div>
    </Link>
  );
};

export default FavouriteItem;
