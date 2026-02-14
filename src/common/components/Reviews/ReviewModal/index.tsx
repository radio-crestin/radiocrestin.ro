import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
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
  stationSlug?: string;
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
  stationSlug,
}) => {
  const router = useRouter();
  const { refreshStations } = useRefreshStations();
  const [selectedStars, setSelectedStars] = useState(0);
  const [hoveredStars, setHoveredStars] = useState(0);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedStars(0);
    setMessage("");
    setLinkCopied(false);
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

  const sendReview = async (stars: number, msg: string) => {
    flushSync(() => {
      setIsSubmitting(true);
    });

    const result = await submitReview({
      station_id: stationId,
      stars,
      message: msg,
      user_identifier: getUserIdentifier(),
    });

    if (result.success && result.data && result.data.__typename === "SubmitReviewResponse") {
      await refreshStations();
      setIsSubmitting(false);
      return true;
    } else {
      setIsSubmitting(false);
      toast.error(result.error || "A aparut o eroare. Te rugam sa incerci din nou.");
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedStars < 1 || selectedStars > 5) return;

    const success = await sendReview(selectedStars, message.trim());
    if (success) {
      toast.success("Multumim pentru recenzia ta!");
      setMessage("");
      setSelectedStars(0);
      onClose();
    }
  };

  const handleStarSelect = (starIndex: number) => {
    setSelectedStars(starIndex);
    setHoveredStars(0);
  };

  const handleShareLink = async () => {
    const slug = stationSlug || router.query.station_slug;
    const reviewUrl = `${window.location.origin}/${slug}/adauga-recenzie`;

    try {
      await navigator.clipboard.writeText(reviewUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = reviewUrl;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    }
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
          disabled={isSubmitting}
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
    <div className={styles.modal_overlay}>
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
            <span className={styles.stars_text}>
              {selectedStars > 0
                ? `${selectedStars} din 5 stele`
                : "Selectează o evaluare"}
            </span>
          </div>

          <div className={styles.message_section}>
            <label htmlFor="review-message" className={styles.label}>
              Mesaj
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

          <div className={styles.actions_row}>
            <button
              type="button"
              className={`${styles.share_button} ${linkCopied ? styles.share_copied : ""}`}
              onClick={handleShareLink}
              aria-label="Copiază link recenzie"
              title="Copiază link recenzie"
            >
              {linkCopied ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 8C19.6569 8 21 6.65685 21 5C21 3.34315 19.6569 2 18 2C16.3431 2 15 3.34315 15 5C15 5.12548 15.0077 5.24917 15.0227 5.37061L8.08261 9.19352C7.54305 8.46267 6.6792 8 5.70588 8C4.21207 8 3 9.34315 3 11C3 12.6569 4.21207 14 5.70588 14C6.6792 14 7.54305 13.5373 8.08261 12.8065L15.0227 16.6294C15.0077 16.7508 15 16.8745 15 17C15 18.6569 16.3431 20 18 20C19.6569 20 21 18.6569 21 17C21 15.3431 19.6569 14 18 14C16.9948 14 16.1095 14.5305 15.5706 15.3294L8.97727 11.6906C8.99234 11.4628 9 11.2327 9 11C9 10.7673 8.99234 10.5372 8.97727 10.3094L15.5706 6.67061C16.1095 7.46953 16.9948 8 18 8Z" fill="currentColor"/>
                </svg>
              )}
            </button>
            {linkCopied && (
              <span className={styles.copied_text}>Link copiat!</span>
            )}

            <button
              type="submit"
              className={`${styles.submit_button} ${isSubmitting ? styles.submitting : ""}`}
              disabled={isSubmitting || selectedStars < 1 || !message.trim()}
            >
              <span className={styles.button_text}>Trimite mesajul</span>
              <span className={styles.button_spinner} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReviewModal;
