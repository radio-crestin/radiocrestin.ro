import React from "react";
import Star from "@/icons/Star";

interface RatingProps {
  score: number;
  starHeight: number;
}

const Rating: React.FC<RatingProps> = ({ score, starHeight }) => {
  const renderStars = () => {
    let stars = [];
    for (let i = 1; i <= 5; i++) {
      let fillWidth = score >= i ? 1 : score > i - 1 ? score - i + 1 : 0;
      stars.push(<Star key={i} fillWidth={fillWidth} height={starHeight} />);
    }
    return stars;
  };

  return <div className="flex flex-row gap-1 text-gray-900 dark:text-gray-100">{renderStars()}</div>;
};

export default Rating;
