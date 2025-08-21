import React from "react";
import Link from "next/link";

export default function DownloadAppBanner() {
  return (
    <div className="pt-25 pl-15 pb-15 flex flex-col bg-blue-100 dark:bg-blue-900 relative justify-between max-w-6xl mx-auto mt-36 rounded-2xl xl:pt-25 xl:flex-row 2xl:flex-col 2xl:pl-0 2xl:items-center 2xl:justify-center">
      <div className="min-w-[560px] p-0 px-5 pb-5 max-w-[625px] box-border xl:p-0 md:p-5 2xl:w-fit 2xl:min-w-0">
        <h2 className="text-gray-900 dark:text-gray-100 font-bold text-3xl font-weight-700 tracking-tight">
          Descarcă aplicația Radio Creștin
        </h2>
        <p className="text-sm mt-1 mb-5 text-gray-900 dark:text-gray-100">
          Toate posturile tale preferate într-un singur loc, gratis și fără
          reclame.
        </p>
        <div className="mt-1 flex gap-3 items-center w-full max-w-md">
          <div className="w-1/3">
            <Link
              href="https://apps.apple.com/app/6451270471"
              target={"_blank"}
            >
              <img
                loading={"lazy"}
                src={"/images/appstore.svg"}
                alt={"AppStore Image Radio Crestin"}
                className="w-full h-auto"
              />
            </Link>
          </div>
          <div className="w-1/3">
            <Link
              href="https://play.google.com/store/apps/details?id=com.radiocrestin.radio_crestin&hl=en_US"
              target={"_blank"}
            >
              <img
                loading={"lazy"}
                src={"/images/playstore.svg"}
                alt={"PlayStore Image Radio Crestin"}
                className="w-full h-auto"
              />
            </Link>
          </div>
          <div className="w-1/3">
            <Link
              href="https://appgallery.huawei.com/app/C109055331"
              target={"_blank"}
            >
              <img
                loading={"lazy"}
                src={"/images/appgallery.svg"}
                alt={"AppGallery Image Radio Crestin"}
                className="w-full h-auto"
              />
            </Link>
          </div>
        </div>
      </div>
      <div className="relative w-full mr-24 2xl:mr-0 2xl:flex 2xl:justify-center 2xl:items-center">
        <img
          loading={"lazy"}
          className="h-auto absolute right-24 -bottom-15 w-full max-w-[524px] pointer-events-none xl:max-w-md xl:right-0 lg:hidden"
          src={
            "https://radio-crestin.s3.eu-central-1.amazonaws.com/media/public/iphone_desktop_size.png"
          }
          alt={"iPhone 13 Radio Crestin"}
        />
        <img
          className="hidden lg:block w-full max-w-sm h-auto absolute right-0 -bottom-15 lg:max-w-xs 2xl:relative 2xl:-bottom-15 sm:max-w-[270px]"
          loading={"lazy"}
          src={
            "https://radio-crestin.s3.eu-central-1.amazonaws.com/media/public/iphone_mob_size.png"
          }
          alt={"iPhone 13 Radio Crestin"}
        />
      </div>
      <img
        loading={"lazy"}
        className="block absolute top-5 right-5 w-24 h-24 lg:hidden"
        src={"/images/qr-code.png"}
        alt={"QR Code Radio Crestin"}
      />
    </div>
  );
}
