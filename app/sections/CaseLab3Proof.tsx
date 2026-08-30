"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState, type FocusEvent } from "react";
import styles from "../case-lab-3/case-lab-3.module.css";

const MOBILE_QUERY = "(max-width: 767px)";
const AUTOPLAY_INTERVAL = 3000;

const testimonials = [
  {
    id: "testimonial-01",
    name: "Екатерина Щипачёва",
    role: "CMO Intertop & Pandora",
    quote:
      "После Case Lab я пересобрала подход к работе с кейсами: меньше теории, больше вопросов к тому, почему команда вообще приняла именно такое решение.",
    photo: "/testimonial-ekaterina.webp",
    reviewHref: "https://www.instagram.com/p/DcYwmZZsQq1/",
  },
  {
    id: "testimonial-02",
    name: "Елена Афонина",
    role: "Управляющий директор Centras Group",
    quote:
      "Увидела, как другие команды находят выход из похожих ситуаций. Забрала несколько идей, которые уже внедрили в следующем спринте.",
    photo: "/testimonial-elena.webp",
    reviewHref: "https://www.instagram.com/p/DcbLF_MsX5Q/",
  },
  {
    id: "testimonial-03",
    name: "Аида Нурсултанова",
    role: "Директор по маркетингу дистрибуции Li Auto",
    quote:
      "Разбор кейсов без прикрас — это то, чего часто не хватает в индустрии. После Case Lab появилось больше смелости принимать решения и тестировать.",
    photo: "/testimonial-aida.webp",
    reviewHref: undefined,
  },
] as const;

export default function CaseLab3Proof() {
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const [isTouching, setIsTouching] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const isInteractionPaused = isFocusWithin || isTouching;

  useEffect(() => {
    const mobileQuery = window.matchMedia(MOBILE_QUERY);
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMedia = () => {
      setIsMobile(mobileQuery.matches);
      setPrefersReducedMotion(reducedMotionQuery.matches);
    };

    updateMedia();
    mobileQuery.addEventListener("change", updateMedia);
    reducedMotionQuery.addEventListener("change", updateMedia);

    return () => {
      mobileQuery.removeEventListener("change", updateMedia);
      reducedMotionQuery.removeEventListener("change", updateMedia);
    };
  }, []);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, { rootMargin: "120px 0px" });
    observer.observe(carousel);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => setIsDocumentVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!isMobile || !isVisible || !isDocumentVisible || isInteractionPaused) return;

    const intervalId = window.setInterval(() => {
      setActiveTestimonial((current) => (current + 1) % testimonials.length);
    }, AUTOPLAY_INTERVAL);

    return () => window.clearInterval(intervalId);
  }, [isDocumentVisible, isInteractionPaused, isMobile, isVisible]);

  useEffect(() => {
    if (!isMobile) return;

    const track = trackRef.current;
    const nextSlide = track?.children[activeTestimonial] as HTMLElement | undefined;
    if (!track || !nextSlide) return;

    track.scrollTo({
      left: nextSlide.offsetLeft,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [activeTestimonial, isMobile, prefersReducedMotion]);

  useEffect(() => () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  }, []);

  const clearResumeTimer = () => {
    if (!resumeTimerRef.current) return;
    clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = null;
  };

  const pauseForInteraction = () => {
    clearResumeTimer();
    setIsTouching(true);
  };

  const resumeAfterTouch = () => {
    clearResumeTimer();
    resumeTimerRef.current = setTimeout(() => {
      setIsTouching(false);
      resumeTimerRef.current = null;
    }, AUTOPLAY_INTERVAL);
  };

  const handleCarouselFocus = () => {
    clearResumeTimer();
    setIsFocusWithin(true);
  };

  const handleCarouselBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsFocusWithin(false);
    }
  };

  const handleTrackScroll = () => {
    if (!isMobile || !trackRef.current || trackRef.current.clientWidth === 0) return;

    const nextIndex = Math.round(trackRef.current.scrollLeft / trackRef.current.clientWidth);
    setActiveTestimonial(Math.max(0, Math.min(nextIndex, testimonials.length - 1)));
  };

  const moveToTestimonial = (direction: -1 | 1) => {
    setActiveTestimonial((current) => (current + direction + testimonials.length) % testimonials.length);
  };

  return (
    <section
      id="case-lab-3-proof"
      tabIndex={-1}
      className={styles.proofSection}
      aria-labelledby="case-lab-3-proof-title"
    >
      <div className={styles.contentShell}>
        <div className={styles.proofIntro}>
          <div>
            <h2 id="case-lab-3-proof-title">ЧТО ГОВОРЯТ УЧАСТНИКИ</h2>
            <p className={styles.proofIntroDescription}>
              Участники прошлых Case Lab рассказывают,
              <br />
              что поменяли в работе после разбора реальных кейсов.
            </p>
          </div>
        </div>

        <div
          ref={carouselRef}
          className={styles.testimonialCarousel}
          role="region"
          aria-roledescription="carousel"
          aria-label="Отзывы участников"
          onFocusCapture={handleCarouselFocus}
          onBlurCapture={handleCarouselBlur}
          onTouchStart={pauseForInteraction}
          onTouchEnd={resumeAfterTouch}
          onTouchCancel={resumeAfterTouch}
        >
          <div ref={trackRef} className={styles.testimonialGallery} onScroll={handleTrackScroll}>
            {testimonials.map((testimonial, testimonialIndex) => {
              return (
                <article
                  key={testimonial.id}
                  className={styles.testimonialCard}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${testimonial.name}, слайд ${testimonialIndex + 1} из ${testimonials.length}`}
                >
                  <div className={styles.testimonialMedia}>
                    <Image
                      src={testimonial.photo}
                      alt=""
                      fill
                      loading="lazy"
                      sizes="(min-width: 1200px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className={styles.testimonialPoster}
                    />
                  </div>

                  <div className={styles.testimonialCardBody}>
                    <h3>{testimonial.name}</h3>
                    <p className={styles.testimonialRole}>{testimonial.role}</p>
                    <span className={styles.testimonialRule} aria-hidden="true" />
                    <blockquote>
                      &laquo;{testimonial.quote}&raquo;
                    </blockquote>
                    {testimonial.reviewHref ? (
                      <a
                        href={testimonial.reviewHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.testimonialReviewLabel}
                      >
                        Посмотреть отзыв
                        <ArrowUpRight size={16} strokeWidth={2} />
                      </a>
                    ) : (
                      <span className={styles.testimonialReviewLabel} aria-hidden="true">
                        Посмотреть отзыв
                        <ArrowUpRight size={16} strokeWidth={2} />
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div className={styles.testimonialCarouselControls}>
            <button
              type="button"
              className={styles.testimonialCarouselButton}
              aria-label="Предыдущий отзыв"
              onClick={() => moveToTestimonial(-1)}
            >
              <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
            </button>
            <span className={styles.testimonialCarouselStatus} aria-live="polite">
              {activeTestimonial + 1} / {testimonials.length}
            </span>
            <button
              type="button"
              className={styles.testimonialCarouselButton}
              aria-label="Следующий отзыв"
              onClick={() => moveToTestimonial(1)}
            >
              <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

        </div>
      </div>
    </section>
  );
}
