import { useEffect, useRef, useState } from "react";

const isElementInViewport = <T extends HTMLElement>(
  el: T | null,
  procentVisible: number,
): boolean => {
  if (!el) return false;
  const rect = el.getBoundingClientRect();

  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth;

  const elementHeight = rect.height;
  const elementWidth = rect.width;

  const heightInView =
    Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
  const widthInView =
    Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0);

  const percentHeightInView = (heightInView / elementHeight) * 100;
  const percentWidthInView = (widthInView / elementWidth) * 100;

  return (
    percentHeightInView >= procentVisible &&
    percentWidthInView >= procentVisible
  );
};

const useIsElementVisible = <T extends HTMLElement>(
  procentVisible: number = 0,
): [React.RefObject<T>, boolean] => {
  const watchedElementRef = useRef<T>(null);
  const [isCurrentlyVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkVisibility = () =>
      setIsVisible(
        isElementInViewport(watchedElementRef.current, procentVisible),
      );
    checkVisibility();

    window.addEventListener("scroll", checkVisibility);

    return () => {
      window.removeEventListener("scroll", checkVisibility);
    };
  }, [procentVisible]);

  return [watchedElementRef, isCurrentlyVisible];
};

export default useIsElementVisible;
