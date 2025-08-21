import Link from "next/link";
import React, { useContext } from "react";

import { Context } from "@/context/ContextProvider";
import Rating from "@/components/Rating";
import { getStationRating } from "@/utils";
import ShareOnSocial from "@/components/ShareOnSocial";
import ThemeToggle from "@/components/ThemeToggle";
import WhatsAppButton from "@/components/WhatsAppButton";

const Navigation = () => (
  <nav className="flex justify-between gap-x-8 md:gap-2.5 md:items-center">
    <div className="flex justify-center items-center gap-4 ml-24 xl:ml-5 md:ml-0">
      <Link
        href={"/"}
        className="flex items-center justify-center text-xl font-bold gap-x-4 p-0"
      >
        <img
          loading={"lazy"}
          src={"/images/radiocrestin_logo.png"}
          width={40}
          height={40}
          alt={"AppStore Image Radio Crestin"}
        />
        <h1 className="text-foreground">Radio Creștin</h1>
      </Link>
    </div>
    <div className="flex gap-5 w-fit">
      <ThemeToggle />
      <WhatsAppButton />
    </div>
  </nav>
);

const ContentLeft = () => {
  const { ctx } = useContext(Context);
  const { selectedStation } = ctx;

  if (!selectedStation) return null;

  return (
    <div className="flex flex-col h-fit mx-24 xl:mx-5 md:hidden">
      {ctx.selectedStation && (
        <>
          {selectedStation.now_playing?.song?.thumbnail_url ? (
            <div className="relative">
              <img
                loading={"lazy"}
                src={selectedStation.now_playing?.song?.thumbnail_url}
                alt={selectedStation.title}
                width={230}
                height={230}
                className="block shadow-md mb-5 object-cover rounded-2xl"
                onError={(e) => {
                  e.currentTarget.src =
                    "/images/radio-crestin-default-logo.png";
                }}
              />
              <img
                loading={"lazy"}
                src={selectedStation?.thumbnail_url}
                alt={selectedStation.title}
                className="absolute rounded-full bottom-1 -right-4 w-14 h-14 mb-0 shadow-sm"
                width={230}
                height={230}
                onError={(e) => {
                  e.currentTarget.src =
                    "/images/radio-crestin-default-logo.png";
                }}
              />
            </div>
          ) : (
            <img
              loading={"lazy"}
              src={selectedStation?.thumbnail_url}
              alt={selectedStation.title}
              width={230}
              height={230}
              className="block shadow-md mb-5 object-cover rounded-2xl"
              onError={(e) => {
                e.currentTarget.src = "/images/radio-crestin-default-logo.png";
              }}
            />
          )}
          <div className="max-w-[230px]">
            <h2 className="font-DMSans_Bold text-2xl font-bold mb-2.5 text-foreground">
              {selectedStation.now_playing?.song?.name || selectedStation.title}
            </h2>
            <p className="text-foreground">
              {selectedStation.now_playing?.song?.artist?.name}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

const ContentRight = () => {
  const { ctx } = useContext(Context);

  return (
    <div className="max-w-4xl w-full">
      <div>
        <div className="md:flex md:flex-col md:justify-center md:items-center md:gap-2.5">
          <img
            src={ctx.selectedStation?.thumbnail_url}
            alt="Radio Crestin"
            height={100}
            width={100}
            className="hidden w-24 rounded-full md:block"
            onError={(e) => {
              e.currentTarget.src = "/images/radio-crestin-default-logo.png";
            }}
          />
          <h1 className="font-DMSans_Bold text-5xl font-bold flex md:text-3xl text-foreground">
            {ctx.selectedStation?.title}
          </h1>
        </div>
        <div className="flex items-center justify-start flex-row gap-1 mt-2.5 mb-5 md:mb-2.5 md:mt-2.5 md:justify-center md:scale-90">
          <Rating
            score={getStationRating(ctx.selectedStation?.reviews)}
            starHeight={22}
          />
          <span className="mt-1 text-foreground">
            ({ctx.selectedStation?.reviews?.length || 0} recenzii)
          </span>
        </div>
        {ctx.selectedStation?.total_listeners !== 0 && (
          <>
            <p className="text-base font-normal mb-5 md:hidden text-foreground">
              {ctx.selectedStation?.total_listeners} persoane ascultă împreună
              cu tine acest radio
            </p>
            <p className="hidden text-sm font-normal mb-5 text-center md:block text-foreground">
              {ctx.selectedStation?.total_listeners} ascultători
            </p>
          </>
        )}
        <p className="text-sm leading-6 font-normal mb-8 line-clamp-5 md:text-sm md:leading-5 md:h-36 md:line-clamp-6 text-foreground">
          {ctx.selectedStation?.description}
        </p>

        <div>
          <ShareOnSocial />
        </div>
      </div>
    </div>
  );
};

const Header = () => {
  return (
    <>
      <header className="max-w-7xl px-16 py-24 lg:px-12 rounded-[50px] mx-auto mt-20 md:px-5 md:py-9 md:h-auto md:rounded-none bg-background-header">
        <Navigation />
        <div className="flex flex-row mt-20 gap-8 md:mt-12">
          <ContentLeft />
          <ContentRight />
        </div>
      </header>
    </>
  );
};

export default Header;
