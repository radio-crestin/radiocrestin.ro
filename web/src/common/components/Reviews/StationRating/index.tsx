import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/router";
import styles from "./styles.module.scss";
import Star from "@/icons/Star";
import ReviewModal from "@/components/Reviews/ReviewModal";
import ReviewsListModal from "@/components/Reviews/ReviewsListModal";
import { getStationReviews } from "@/services/getStations";
import { IReview, IReviewsStats } from "@/models/Station";

interface StationRatingProps {
  stationId: number;
  stationTitle: string;
  stationSlug?: string;
  reviewsStats?: IReviewsStats;
}

const StationRating: React.FC<StationRatingProps> = ({
  stationId,
  stationTitle,
  stationSlug,
  reviewsStats,
}) => {
  const router = useRouter();
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isReviewsListModalOpen, setIsReviewsListModalOpen] = useState(false);
  const [reviews, setReviews] = useState<IReview[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);

  const score = reviewsStats?.average_rating || 0;
  const slug = stationSlug || router.query.station_slug;

  const handleOpenReviewModal = useCallback(() => {
    setIsReviewModalOpen(true);
    if (!window.location.pathname.endsWith("/adauga-recenzie")) {
      window.history.pushState(null, "", `/${slug}/adauga-recenzie`);
    }
  }, [slug]);

  const handleReviewModalClose = useCallback(() => {
    setIsReviewModalOpen(false);
    if (window.location.pathname.endsWith("/adauga-recenzie")) {
      window.history.replaceState(null, "", `/${slug}`);
    }
  }, [slug]);

  const handleOpenReviewsList = useCallback(async () => {
    setIsReviewsListModalOpen(true);
    if (!window.location.pathname.endsWith("/reviews")) {
      window.history.pushState(null, "", `/${slug}/reviews`);
    }
    setIsLoadingReviews(true);

    const fetchedReviews = await getStationReviews(stationId);
    setReviews(fetchedReviews);
    setIsLoadingReviews(false);
  }, [stationId, slug]);

  const handleCloseReviewsList = useCallback(() => {
    setIsReviewsListModalOpen(false);
    if (window.location.pathname.endsWith("/reviews")) {
      window.history.replaceState(null, "", `/${slug}`);
    }
  }, [slug]);

  const handleWriteReviewFromList = useCallback(() => {
    setIsReviewsListModalOpen(false);
    handleOpenReviewModal();
  }, [handleOpenReviewModal]);

  // Auto-open modals based on URL path
  useEffect(() => {
    const path = window.location.pathname;
    if (path.endsWith("/adauga-recenzie")) {
      setIsReviewModalOpen(true);
    } else if (path.endsWith("/reviews")) {
      handleOpenReviewsList();
    }
  }, [handleOpenReviewsList]);

  // Handle browser back button
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      setIsReviewsListModalOpen(path.endsWith("/reviews"));
      setIsReviewModalOpen(path.endsWith("/adauga-recenzie"));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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
        <a
          className={styles.reviews_count}
          href={`/${slug}/reviews`}
          onClick={(e) => {
            e.preventDefault();
            handleOpenReviewsList();
          }}
        >
          ({reviewsStats?.number_of_reviews === 1 ? "o recenzie" : `${reviewsStats?.number_of_reviews || 0} recenzii`})
        </a>
        <a
          className={styles.add_review_button}
          href={`/${slug}/adauga-recenzie`}
          onClick={(e) => {
            e.preventDefault();
            handleOpenReviewModal();
          }}
        >
          Adaugă o recenzie
        </a>
      </div>

      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={handleReviewModalClose}
        stationId={stationId}
        stationTitle={stationTitle}
        stationSlug={stationSlug}
      />
      <ReviewsListModal
        isOpen={isReviewsListModalOpen}
        onClose={handleCloseReviewsList}
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
