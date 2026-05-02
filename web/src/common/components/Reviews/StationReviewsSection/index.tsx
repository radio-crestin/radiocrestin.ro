import React, { useEffect, useState } from "react";
import styles from "./styles.module.scss";
import Star from "@/icons/Star";
import { getStationReviews } from "@/services/getStations";
import type { IReview, IReviewsStats } from "@/models/Station";
import { SITE_URL } from "@/constants/constants";

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

  // Inject Review JSON-LD schema dynamically
  useEffect(() => {
    if (reviews.length === 0) return;

    const reviewSchemaData = {
      "@context": "https://schema.org",
      "@type": "RadioStation",
      name: stationTitle,
      url: `${SITE_URL}/${stationSlug}`,
      ...(reviewsStats && reviewsStats.number_of_reviews > 0 && {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: reviewsStats.average_rating,
          reviewCount: reviewsStats.number_of_reviews,
          bestRating: 5,
          worstRating: 1,
        },
      }),
      review: reviews.slice(0, 10).map((review) => ({
        "@type": "Review",
        reviewRating: {
          "@type": "Rating",
          ratingValue: review.stars,
          bestRating: 5,
          worstRating: 1,
        },
        datePublished: review.created_at.split("T")[0],
        ...(review.message && { reviewBody: review.message }),
      })),
    };

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(reviewSchemaData);
    script.id = "review-schema";
    // Remove existing one if present
    const existing = document.getElementById("review-schema");
    if (existing) existing.remove();
    document.head.appendChild(script);

    return () => {
      const el = document.getElementById("review-schema");
      if (el) el.remove();
    };
  }, [reviews, stationTitle, stationSlug, reviewsStats]);

  if (isLoading) {
    return (
      <section id="reviews" className={styles.reviews_section}>
        <div className={styles.section_header}>
          <h2 className={styles.section_title}>Recenzii {stationTitle}</h2>
          <button
            type="button"
            className={styles.add_review_button}
            onClick={handleOpenAddReview}
          >
            Adaugă o recenzie
          </button>
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
          <button
            type="button"
            className={styles.add_review_button}
            onClick={handleOpenAddReview}
          >
            Adaugă o recenzie
          </button>
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
        <button
          type="button"
          className={styles.add_review_button}
          onClick={handleOpenAddReview}
        >
          Adaugă o recenzie
        </button>
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
