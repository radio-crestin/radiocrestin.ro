import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import styles from "./styles.module.scss";
import Star from "@/icons/Star";
import { getStationReviews } from "@/services/getStations";
import type { IReview, IReviewsStats } from "@/models/Station";

interface StationReviewsSectionProps {
  stationId: number;
  stationTitle: string;
  stationSlug: string;
  reviewsStats?: IReviewsStats;
}

const StationReviewsSection: React.FC<StationReviewsSectionProps> = ({
  stationId,
  stationTitle,
  stationSlug,
  reviewsStats,
}) => {
  const [reviews, setReviews] = useState<IReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      const fetchedReviews = await getStationReviews(stationId);
      setReviews(fetchedReviews);
      setIsLoading(false);
    };
    fetchReviews();
  }, [stationId]);

  // Smooth-scroll to section when URL hash is #reviews (works after async load)
  useEffect(() => {
    if (isLoading) return;
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#reviews") return;
    const el = document.getElementById("reviews");
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [isLoading]);

  const handleOpenAddReview = () => {
    window.dispatchEvent(new CustomEvent("open-review-modal"));
  };

  const handleShareReviews = async () => {
    const reviewsUrl = `${window.location.origin}/${stationSlug}/#reviews`;
    try {
      await navigator.clipboard.writeText(reviewsUrl);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = reviewsUrl;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
    toast.success("Link copiat!");
  };

  // No client-side Review JSON-LD: reviews are anonymous (no author field,
  // which Google requires — it flagged these as invalid rich results), and it
  // duplicated the RadioStation node already server-rendered by the station
  // page, whose AggregateRating keeps star snippets eligible on its own.

  if (isLoading) {
    return (
      <section id="reviews" className={styles.reviews_section}>
        <div className={styles.section_header}>
          <h2 className={styles.section_title}>Recenzii {stationTitle}</h2>
          <div className={styles.section_actions}>
            <button
              type="button"
              className={styles.share_button}
              onClick={handleShareReviews}
              aria-label="Copiază linkul către recenzii"
              title="Copiază linkul către recenzii"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              Distribuie
            </button>
            <button
              type="button"
              className={styles.add_review_button}
              onClick={handleOpenAddReview}
            >
              Adaugă o recenzie
            </button>
          </div>
        </div>
        <p className={styles.loading}>Se incarca recenziile...</p>
      </section>
    );
  }

  if (reviews.length === 0) {
    return (
      <section id="reviews" className={styles.reviews_section}>
        <div className={styles.section_header}>
          <h2 className={styles.section_title}>Recenzii {stationTitle}</h2>
          <div className={styles.section_actions}>
            <button
              type="button"
              className={styles.share_button}
              onClick={handleShareReviews}
              aria-label="Copiază linkul către recenzii"
              title="Copiază linkul către recenzii"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              Distribuie
            </button>
            <button
              type="button"
              className={styles.add_review_button}
              onClick={handleOpenAddReview}
            >
              Adaugă o recenzie
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="reviews" className={styles.reviews_section}>
      <div className={styles.section_header}>
        <h2 className={styles.section_title}>
          Recenzii {stationTitle} ({reviewsStats?.number_of_reviews || reviews.length})
        </h2>
        <div className={styles.section_actions}>
          <button
            type="button"
            className={styles.share_button}
            onClick={handleShareReviews}
            aria-label="Copiază linkul către recenzii"
            title="Copiază linkul către recenzii"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Distribuie
          </button>
          <button
            type="button"
            className={styles.add_review_button}
            onClick={handleOpenAddReview}
          >
            Adaugă o recenzie
          </button>
        </div>
      </div>
      <div className={styles.reviews_list}>
        {reviews.map((review) => (
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
        ))}
      </div>
    </section>
  );
};

export default StationReviewsSection;
