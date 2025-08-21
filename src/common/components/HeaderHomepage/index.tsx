import Link from "next/link";
import React from "react";

const Navigation = () => (
  <nav className="flex justify-between gap-x-8 md:gap-x-2.5 md:items-center">
    <div className="flex justify-center items-center gap-4 ml-24 lg:ml-5 md:ml-0">
      <Link href={"/"} className="flex items-center justify-center text-xl font-bold gap-x-4 p-0">
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
  </nav>
);

const ContentLeft = () => {
  return (
    <div className="max-w-[850px] w-full">
      <div>
        <h1 className="font-bold text-5xl text-foreground md:text-3xl">Bine ați venit</h1>
        <p className="text-sm leading-6 font-normal mt-5 mb-8 text-foreground md:text-sm md:leading-5">
          „Iubesc pe Domnul, căci El aude glasul meu, cererile mele. Da, El Și-a
          plecat urechea spre mine, de aceea-L voi chema toată viața mea.&rdquo;
          <br />- Psalmii 116:1-2
        </p>
      </div>
    </div>
  );
};

const HeaderHomepage = () => {
  return (
    <>
      <header className="relative max-w-7xl px-16 py-16 min-h-[400px] rounded-[50px] mx-auto mt-20 md:px-5 md:py-9 md:min-h-[300px] md:rounded-none bg-background-header">
        <Navigation />
        <div className="flex flex-row mt-20 gap-8 md:mt-12" style={{ height: "150px" }}>
          <ContentLeft />
        </div>
        <img
          className="absolute right-48 bottom-0 md:right-10 md:w-32"
          src={"/images/vector_yellow.svg"}
          alt={"vector_yellow"}
        />
      </header>
    </>
  );
};

export default HeaderHomepage;
