import React, { useState, useCallback, useEffect } from "react";
import styles from "./styles.module.scss";
import Star from "@/icons/Star";
import ReviewModal from "@/components/Reviews/ReviewModal";
import ReviewsListModal from "@/components/Reviews/ReviewsListModal";
import ReviewsModalShell from "@/components/Reviews/ReviewsModalShell";
import { getStationReviews } from "@/services/getStations";
import type { IReview, IReviewsStats } from "@/models/Station";

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
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isReviewsListModalOpen, setIsReviewsListModalOpen] = useState(false);
  const [reviews, setReviews] = useState<IReview[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const score = reviewsStats?.average_rating || 0;
  const slug = stationSlug || window.location.pathname.split("/")[1];

  // The host serves URLs with a trailing slash, so path checks must
  // tolerate both "/x/reviews" and "/x/reviews/".
  const pathEndsWith = (segment: string) =>
    window.location.pathname.replace(/\/+$/, "").endsWith(segment);

  const handleOpenReviewModal = useCallback(() => {
    setIsReviewModalOpen(true);
    if (!pathEndsWith("/adauga-recenzie")) {
      window.history.pushState(null, "", `/${slug}/adauga-recenzie/`);
    }
  }, [slug]);

  const handleReviewModalClose = useCallback(() => {
    setIsReviewModalOpen(false);
    if (pathEndsWith("/adauga-recenzie")) {
      window.history.replaceState(null, "", `/${slug}/`);
    }
  }, [slug]);

  const handleOpenReviewsList = useCallback(async () => {
    setIsReviewsListModalOpen(true);
    if (!pathEndsWith("/reviews")) {
      window.history.pushState(null, "", `/${slug}/reviews/`);
    }
    setIsLoadingReviews(true);

    const fetchedReviews = await getStationReviews(stationId);
    setReviews(fetchedReviews);
    setIsLoadingReviews(false);
  }, [stationId, slug]);

  const handleCloseReviewsList = useCallback(() => {
    setIsReviewsListModalOpen(false);
    if (pathEndsWith("/reviews")) {
      window.history.replaceState(null, "", `/${slug}/`);
    }
  }, [slug]);

  const handleWriteReviewFromList = useCallback(() => {
    setIsReviewsListModalOpen(false);
    handleOpenReviewModal();
  }, [handleOpenReviewModal]);

  // Auto-open modals based on URL path
  useEffect(() => {
    if (pathEndsWith("/adauga-recenzie")) {
      setIsReviewModalOpen(true);
    } else if (pathEndsWith("/reviews")) {
      handleOpenReviewsList();
    }
  }, [handleOpenReviewsList]);

  // Handle browser back button
  useEffect(() => {
    const handlePopState = () => {
      setIsReviewsListModalOpen(pathEndsWith("/reviews"));
      setIsReviewModalOpen(pathEndsWith("/adauga-recenzie"));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Open review modal in response to a global request (e.g. button in reviews section)
  useEffect(() => {
    const handler = () => handleOpenReviewModal();
    window.addEventListener("open-review-modal", handler);
    return () => window.removeEventListener("open-review-modal", handler);
  }, [handleOpenReviewModal]);

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
          href={`/${slug}/reviews/`}
          onClick={(e) => {
            e.preventDefault();
            handleOpenReviewsList();
          }}
        >
          ({reviewsStats?.number_of_reviews === 1 ? "o recenzie" : `${reviewsStats?.number_of_reviews || 0} recenzii`})
        </a>
        <a
          className={styles.add_review_button}
          href={`/${slug}/adauga-recenzie/`}
          onClick={(e) => {
            e.preventDefault();
            handleOpenReviewModal();
          }}
        >
          Adaugă o recenzie
        </a>
      </div>

      <ReviewsModalShell
        view={isReviewModalOpen ? "write" : isReviewsListModalOpen ? "list" : null}
        stationTitle={stationTitle}
        closeDisabled={isSubmittingReview}
        onClose={isReviewModalOpen ? handleReviewModalClose : handleCloseReviewsList}
        renderPanel={(shownView) =>
          shownView === "write" ? (
            <ReviewModal
              onClose={handleReviewModalClose}
              stationId={stationId}
              stationTitle={stationTitle}
              stationSlug={stationSlug}
              onBusyChange={setIsSubmittingReview}
            />
          ) : (
            <ReviewsListModal
              onClose={handleCloseReviewsList}
              stationTitle={stationTitle}
              reviews={reviews}
              reviewsStats={reviewsStats}
              isLoading={isLoadingReviews}
              onWriteReview={handleWriteReviewFromList}
            />
          )
        }
      />
    </>
  );
};

export default StationRating;
