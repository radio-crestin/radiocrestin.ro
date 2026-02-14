import React, { useEffect, useState } from "react";
import Head from "next/head";
import styles from "./styles.module.scss";
import Star from "@/icons/Star";
import { getStationReviews } from "@/services/getStations";
import { IReview, IReviewsStats } from "@/models/Station";
import { SITE_URL } from "@/constants/constants";

interface StationReviewsSectionProps {
  stationId: number;
  stationTitle: string;
  stationSlug: string;
  reviewsStats?: IReviewsStats;
}

const MAX_VISIBLE_REVIEWS = 5;

const StationReviewsSection: React.FC<StationReviewsSectionProps> = ({
  stationId,
  stationTitle,
  stationSlug,
  reviewsStats,
}) => {
  const [reviews, setReviews] = useState<IReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const fetchReviews = async () => {
      const fetchedReviews = await getStationReviews(stationId);
      setReviews(fetchedReviews);
      setIsLoading(false);
    };
    fetchReviews();
  }, [stationId]);

  const visibleReviews = showAll ? reviews : reviews.slice(0, MAX_VISIBLE_REVIEWS);

  // Build Review schema data - all data sourced from our own trusted API
  const reviewSchemaData = reviews.length > 0
    ? {
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
      }
    : null;

  if (isLoading) {
    return (
      <section className={styles.reviews_section}>
        <h2 className={styles.section_title}>Recenzii {stationTitle}</h2>
        <p className={styles.loading}>Se incarca recenziile...</p>
      </section>
    );
  }

  if (reviews.length === 0) {
    return null;
  }

  return (
    <section className={styles.reviews_section}>
      {/* Inject Review JSON-LD schema once reviews load - data from our own API */}
      {reviewSchemaData && (
        <Head>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(reviewSchemaData),
            }}
          />
        </Head>
      )}
      <h2 className={styles.section_title}>
        Recenzii {stationTitle} ({reviewsStats?.number_of_reviews || reviews.length})
      </h2>
      <div className={styles.reviews_list}>
        {visibleReviews.map((review) => (
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
      {reviews.length > MAX_VISIBLE_REVIEWS && !showAll && (
        <button
          className={styles.show_all_button}
          onClick={() => setShowAll(true)}
        >
          Vezi toate cele {reviews.length} recenzii
        </button>
      )}
    </section>
  );
};

export default StationReviewsSection;
