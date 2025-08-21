import { useEffect, useState } from "react";

export default function NoInternetConnection({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  return (
    <div className="relative w-full h-full">
      {children}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-70 backdrop-blur-sm z-[9999] flex justify-center items-center">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl text-center max-w-[90%] shadow-lg m-5">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-gray-700 dark:text-gray-300"
            >
              <path
                d="M12 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm0-4c-.55 0-1-.45-1-1V8c0-.55.45-1 1-1s1 .45 1 1v5c0 .55-.45 1-1 1z"
                fill="currentColor"
              />
              <path
                d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"
                fill="currentColor"
              />
              <path
                d="M2 2L22 22"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <div className="mt-12">
              <h2 className="mt-0 text-red-600 dark:text-red-400 mb-4 text-xl font-semibold">
                Nu există conexiune la internet
              </h2>
              <p className="mb-0 text-gray-800 dark:text-gray-200">
                Vă rugăm să verificați conexiunea și să încercați din nou.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
