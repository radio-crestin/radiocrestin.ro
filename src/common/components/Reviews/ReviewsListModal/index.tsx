import React, { useEffect } from "react";
import styles from "./styles.module.scss";
import Star from "@/icons/Star";
import { IReview, IReviewsStats } from "@/models/Station";

interface ReviewsListModalProps {
  isOpen: boolean;
  onClose: () => void;
  stationTitle: string;
  reviews: IReview[];
  reviewsStats?: IReviewsStats;
  isLoading?: boolean;
  onWriteReview: () => void;
}

const ReviewsListModal: React.FC<ReviewsListModalProps> = ({
  isOpen,
  onClose,
  stationTitle,
  reviews,
  reviewsStats,
  isLoading = false,
  onWriteReview,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const averageRating = reviewsStats?.average_rating || 0;
  const totalReviews = reviewsStats?.number_of_reviews || 0;

  if (!isOpen) return null;

  return (
    <div className={styles.modal_overlay} onClick={handleBackdropClick}>
      <div className={styles.modal_content}>
        <button className={styles.close_button} onClick={onClose} aria-label="Inchide">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <h2 className={styles.modal_title}>Recenzii</h2>
        <p className={styles.station_name}>{stationTitle}</p>

        <div className={styles.summary}>
          <div className={styles.average_rating}>
            <span className={styles.rating_number}>{averageRating.toFixed(1)}</span>
            <div className={styles.stars_row}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  fillWidth={averageRating >= i ? 1 : averageRating > i - 1 ? averageRating - i + 1 : 0}
                  height={20}
                />
              ))}
            </div>
            <span className={styles.total_reviews}>{totalReviews === 1 ? "o recenzie" : `${totalReviews} recenzii`}</span>
          </div>
          <button className={styles.write_review_button} onClick={onWriteReview}>
            Scrie o recenzie
          </button>
        </div>

        <div className={styles.reviews_list}>
          {isLoading ? (
            <div className={styles.loading}>
              <div className={styles.loading_spinner}></div>
              <p>Se incarca recenziile...</p>
            </div>
          ) : reviews.length === 0 ? (
            <p className={styles.no_reviews}>Nu exista recenzii inca. Fii primul care lasa o recenzie!</p>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className={styles.review_item}>
                <div className={styles.review_header}>
                  <div className={styles.review_stars}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} fillWidth={i <= review.stars ? 1 : 0} height={16} />
                    ))}
                  </div>
                  <span className={styles.review_date}>
                    {new Date(review.created_at).toLocaleDateString("ro-RO", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                {review.message && (
                  <p className={styles.review_message}>{review.message}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewsListModal;
