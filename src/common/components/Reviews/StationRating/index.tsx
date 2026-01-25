import React, { useState, useCallback } from "react";
import styles from "./styles.module.scss";
import Star from "@/icons/Star";
import ReviewModal from "@/components/Reviews/ReviewModal";
import ReviewsListModal from "@/components/Reviews/ReviewsListModal";
import { getStationReviews } from "@/services/getStations";
import { IReview, IReviewsStats } from "@/models/Station";

interface StationRatingProps {
  stationId: number;
  stationTitle: string;
  reviewsStats?: IReviewsStats;
}

const StationRating: React.FC<StationRatingProps> = ({
  stationId,
  stationTitle,
  reviewsStats,
}) => {
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isReviewsListModalOpen, setIsReviewsListModalOpen] = useState(false);
  const [reviews, setReviews] = useState<IReview[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);

  const score = reviewsStats?.average_rating || 0;

  const handleWriteReviewFromList = () => {
    setIsReviewsListModalOpen(false);
    setIsReviewModalOpen(true);
  };

  const handleOpenReviewsList = useCallback(async () => {
    setIsReviewsListModalOpen(true);
    setIsLoadingReviews(true);

    const fetchedReviews = await getStationReviews(stationId);
    setReviews(fetchedReviews);
    setIsLoadingReviews(false);
  }, [stationId]);

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      const fillWidth = score >= i ? 1 : score > i - 1 ? score - i + 1 : 0;
      stars.push(
        <span key={i} className={styles.star_display}>
          <Star fillWidth={fillWidth} height={22} />
        </span>
      );
    }
    return stars;
  };

  return (
    <>
      <div className={styles.rating_wrapper}>
        <div className={styles.stars_row}>
          {renderStars()}
        </div>
        <button
          className={styles.reviews_count}
          onClick={handleOpenReviewsList}
        >
          ({reviewsStats?.number_of_reviews === 1 ? "o recenzie" : `${reviewsStats?.number_of_reviews || 0} recenzii`})
        </button>
        <button
          className={styles.add_review_button}
          onClick={() => setIsReviewModalOpen(true)}
        >
          Adaugă o recenzie
        </button>
      </div>

      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        stationId={stationId}
        stationTitle={stationTitle}
      />
      <ReviewsListModal
        isOpen={isReviewsListModalOpen}
        onClose={() => setIsReviewsListModalOpen(false)}
        stationTitle={stationTitle}
        reviews={reviews}
        reviewsStats={reviewsStats}
        isLoading={isLoadingReviews}
        onWriteReview={handleWriteReviewFromList}
      />
    </>
  );
};

export default StationRating;
