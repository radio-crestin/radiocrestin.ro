import React from "react";

export default function InstallMobileAppButton() {
  return (
      <div className="hidden md:block relative py-10 px-5 bg-gray-100 dark:bg-gray-700">
        <p className="text-lg leading-5 mb-2">
          Te invităm să instalezi aplicația mobilă Radio Creștin.
        </p>
        <div className="flex items-center gap-x-4 flex-wrap">
          <a
              href="https://play.google.com/store/apps/details?id=com.radiocrestin.radio_crestin&pcampaignid=web_share&ref=website"
              target="_blank"
          >
            <img src="./images/google-play-badge.svg" alt="Instaleaza aplicatia RadioCrestin pe Android." className="w-40" />
          </a>

          <a
              href="https://apps.apple.com/ro/app/radio-crestin/id6451270471?l=ro&ref=website"
              target="_blank"
          >
            <img src="./images/app-store-badge.svg" alt="Instaleaza aplicatia RadioCrestin pe iOS." className="w-40" />
          </a>
        </div>

      </div>
  );
}
