import React, { useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import styles from "./styles.module.scss";
import Star from "@/icons/Star";
import { submitReview } from "@/services/submitReview";
import { toast } from "react-toastify";
import { useRefreshStations } from "@/hooks/useUpdateStationsMetadata";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  stationId: number;
  stationTitle: string;
}

const getUserIdentifier = (): string => {
  const storageKey = "radio_crestin_user_id";
  let userId = localStorage.getItem(storageKey);
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(storageKey, userId);
  }
  return userId;
};

const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  stationId,
  stationTitle,
}) => {
  const { refreshStations } = useRefreshStations();
  const [selectedStars, setSelectedStars] = useState(0);
  const [hoveredStars, setHoveredStars] = useState(0);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [starsError, setStarsError] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedStars(0);
    setStarsError(false);
    const scrollY = window.scrollY;
    document.body.style.cssText = `overflow-y: scroll; position: fixed; width: 100%; top: -${scrollY}px`;
    return () => {
      document.body.style.cssText = "";
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedStars < 1 || selectedStars > 5) {
      setStarsError(true);
      return;
    }

    flushSync(() => {
      setIsSubmitting(true);
    });

    const result = await submitReview({
      station_id: stationId,
      stars: selectedStars,
      message: message.trim(),
      user_identifier: getUserIdentifier(),
    });

    if (result.success && result.data && result.data.__typename === "SubmitReviewResponse") {
      await refreshStations();
      toast.success("Multumim pentru recenzia ta!");
      setMessage("");
      setSelectedStars(0);
      setIsSubmitting(false);
      onClose();
    } else {
      setIsSubmitting(false);
      toast.error(result.error || "A aparut o eroare. Te rugam sa incerci din nou.");
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  };

  const handleStarSelect = (starIndex: number) => {
    setSelectedStars(starIndex);
    setHoveredStars(0);
    setStarsError(false);
  };

  const renderStarSelector = () => {
    const stars = [];
    const displayStars = hoveredStars || selectedStars;

    for (let i = 1; i <= 5; i++) {
      stars.push(
        <button
          key={i}
          type="button"
          className={styles.star_button}
          onMouseEnter={() => setHoveredStars(i)}
          onMouseLeave={() => setHoveredStars(0)}
          onTouchEnd={(e) => {
            e.preventDefault();
            handleStarSelect(i);
          }}
          onClick={() => handleStarSelect(i)}
          aria-label={`${i} stele`}
        >
          <Star fillWidth={i <= displayStars ? 1 : 0} height={32} />
        </button>
      );
    }
    return stars;
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modal_overlay} onClick={handleBackdropClick}>
      <div className={styles.modal_content}>
        <button
          className={styles.close_button}
          onClick={onClose}
          aria-label="Inchide"
          disabled={isSubmitting}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <h2 className={styles.modal_title}>Adaugă o recenzie</h2>
        <p className={styles.station_name}>{stationTitle}</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.stars_section}>
            <label className={styles.label}>Evaluarea ta</label>
            <div className={styles.stars_container}>
              {renderStarSelector()}
            </div>
            {starsError ? (
              <span className={styles.stars_error}>⚠️ Te rugăm să selectezi o evaluare</span>
            ) : (
              <span className={styles.stars_text}>
                {selectedStars > 0 ? `${selectedStars} din 5 stele` : "Selectează o evaluare"}
              </span>
            )}
          </div>

          <div className={styles.message_section}>
            <label htmlFor="review-message" className={styles.label}>
              Mesaj (optional)
            </label>
            <textarea
              ref={textareaRef}
              id="review-message"
              className={styles.textarea}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Spune-ne parerea ta despre acest radio..."
              rows={4}
              maxLength={500}
            />
            <span className={styles.char_count}>{message.length}/500</span>
          </div>

          <button
            type="submit"
            className={`${styles.submit_button} ${isSubmitting ? styles.submitting : ""}`}
            disabled={isSubmitting}
          >
            <span className={styles.button_text}>Trimite recenzia</span>
            <span className={styles.button_spinner} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ReviewModal;
