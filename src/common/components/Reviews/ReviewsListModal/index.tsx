import React, { useMemo } from "react";
import styles from "./styles.module.scss";
import Star from "@/icons/Star";
import type { IReview, IReviewsStats } from "@/models/Station";

// Panel content only — the portal, backdrop, scroll lock and Escape/backdrop
// closing live in ReviewsModalShell, which keeps one persistent overlay
// while this panel and the write panel swap inside it.
interface ReviewsListModalProps {
  onClose: () => void;
  stationTitle: string;
  reviews: IReview[];
  reviewsStats?: IReviewsStats;
  isLoading?: boolean;
  onWriteReview: () => void;
}

const ReviewsListModal: React.FC<ReviewsListModalProps> = ({
  onClose,
  stationTitle,
  reviews,
  reviewsStats,
  isLoading = false,
  onWriteReview,
}) => {
  // Per-star counts for the distribution bars; scaled against the most
  // common rating (app-store style) so bars stay readable at low volumes
  const distribution = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    reviews.forEach((r) => {
      const s = Math.round(r.stars);
      if (s >= 1 && s <= 5) counts[s - 1] += 1;
    });
    return counts;
  }, [reviews]);
  const maxCount = Math.max(1, ...distribution);

  const averageRating = reviewsStats?.average_rating || 0;
  const totalReviews = reviewsStats?.number_of_reviews || 0;

  return (
    <div className={styles.modal_content}>
      <div className={styles.modal_header}>
        <div className={styles.header_text}>
          <h2 className={styles.modal_title}>Recenzii</h2>
          <p className={styles.station_name}>{stationTitle}</p>
        </div>
        <button className={styles.close_button} onClick={onClose} aria-label="Închide">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className={styles.modal_body}>
        <div className={styles.summary}>
          <div className={styles.average_block}>
            <span className={styles.rating_number}>{averageRating.toFixed(1)}</span>
            <div className={styles.stars_row}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  fillWidth={averageRating >= i ? 1 : averageRating > i - 1 ? averageRating - i + 1 : 0}
                  height={17}
                />
              ))}
            </div>
            <span className={styles.total_reviews}>
              {totalReviews === 1 ? "o recenzie" : `${totalReviews} recenzii`}
            </span>
          </div>
          <div className={styles.distribution} aria-hidden="true">
            {[5, 4, 3, 2, 1].map((s) => (
              <div key={s} className={styles.dist_row}>
                <span className={styles.dist_label}>{s}</span>
                <div className={styles.dist_track}>
                  <div
                    className={styles.dist_fill}
                    style={{ width: isLoading ? 0 : `${(distribution[s - 1] / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.reviews_list}>
          {isLoading ? (
            <div className={styles.skeleton_list}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={styles.skeleton_review}>
                  <div className={styles.skeleton_review_header}>
                    <div className={styles.skeleton_stars}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <div key={s} className={styles.skeleton_star} />
                      ))}
                    </div>
                    <div className={styles.skeleton_date} />
                  </div>
                  <div className={styles.skeleton_message}>
                    <div className={styles.skeleton_text_line} style={{ width: `${60 + (i % 3) * 15}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className={styles.no_reviews}>
              <span className={styles.no_reviews_icon}>
                <Star fillWidth={0} height={26} />
              </span>
              <p className={styles.no_reviews_title}>Nu există recenzii încă</p>
              <p className={styles.no_reviews_hint}>Fii primul care lasă o recenzie despre acest radio.</p>
            </div>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className={styles.review_item}>
                <div className={styles.review_header}>
                  <div className={styles.review_stars}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} fillWidth={i <= review.stars ? 1 : 0} height={15} />
                    ))}
                  </div>
                  <time className={styles.review_date} dateTime={review.created_at}>
                    {new Date(review.created_at).toLocaleDateString("ro-RO", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                </div>
                {review.message && (
                  <p className={styles.review_message}>{review.message}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className={styles.modal_footer}>
        <button className={styles.write_review_button} onClick={onWriteReview}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          Scrie o recenzie
        </button>
      </div>
    </div>
  );
};

export default ReviewsListModal;
