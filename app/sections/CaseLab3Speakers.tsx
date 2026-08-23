"use client";

import Image from "next/image";
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "../case-lab-3/case-lab-3.module.css";

gsap.registerPlugin(ScrollTrigger);

const cases = [
  {
    company: "Ануар Абдрахманов",
    captionLines: ["Ануар", "Абдрахманов"],
    role: "exCMO Invictus Go · нынешний CMO Bayan Sulu",
    title: "Как масштабировать точки и не потерять спрос",
    description: "О решениях, которые стояли за открытием успешных залов в Алматы и за его пределами. Какие точки роста команда проверяла первой. И что пришлось пересобрать внутри бизнеса.",
    image: "/Invictus GO.webp",
    alt: "Визуальные материалы кейса Invictus Go",
  },
  {
    company: "Перизат Сейфульмаликова",
    captionLines: ["Перизат", "Сейфульмаликова"],
    role: "CMO Qara Studios",
    title: "Что осталось после OYU Fest 2026",
    description: "Результаты прошедшего фестиваля и разбор решений, которые к ним привели. Что осталось после события, кроме красивой картинки. И какие идеи продолжают работать дальше.",
    image: "/OYU Fest 2026.webp",
    alt: "Визуальные материалы кейса OYU Fest 2026",
  },
  {
    company: "Forte Bank × GForce Grey",
    captionLines: ["Forte Bank ×", "GForce Grey"],
    role: "Спикер уточняется",
    title: "Когда инсталляция становится метрикой",
    description: "Кейс «Спасение собаки» и то, как идея повлияла на показатели бренда. Как инсталляция стала частью разговора с аудиторией. И почему это вышло за пределы обычной кампании.",
    image: "/ForteXGForce.webp",
    alt: "Визуальные материалы кейса Forte Bank и GForce Grey",
  },
];

const caseStates = [
  [0, 1, 2],
  [1, 2, 0],
  [2, 0, 1],
] as const;

export default function CaseLab3Speakers() {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const featureLayersRef = useRef<(HTMLElement | null)[]>([]);
  const supportingLayersOneRef = useRef<(HTMLElement | null)[]>([]);
  const supportingLayersTwoRef = useRef<(HTMLElement | null)[]>([]);
  const copyLayersRef = useRef<(HTMLElement | null)[]>([]);

  useLayoutEffect(() => {
    const scene = sceneRef.current;
    const stage = stageRef.current;

    if (!scene || !stage) return;

    let revertMedia: (() => void) | undefined;
    const context = gsap.context(() => {
      const media = gsap.matchMedia();
      revertMedia = () => media.revert();

      media.add("(min-width: 768px)", () => {
        const slots = [
          featureLayersRef.current,
          supportingLayersOneRef.current,
          supportingLayersTwoRef.current,
        ];
        let activeCopyState = 0;

        const setCopyAriaState = (stateIndex: number) => {
          copyLayersRef.current.forEach((layer, caseIndex) => {
            if (layer) layer.setAttribute("aria-hidden", String(caseIndex !== stateIndex));
          });
        };

        const setState = (stateIndex: number) => {
          const state = caseStates[stateIndex];

          slots.forEach((slot, slotIndex) => {
            slot.forEach((layer, caseIndex) => {
              if (layer) {
                gsap.set(layer, {
                  opacity: caseIndex === state[slotIndex] ? 1 : 0,
                  scale: 1,
                });
              }
            });
          });

          copyLayersRef.current.forEach((layer, caseIndex) => {
            if (!layer) return;
            gsap.set(layer, { opacity: caseIndex === stateIndex ? 1 : 0, y: 0 });
            layer.setAttribute("aria-hidden", String(caseIndex !== stateIndex));
          });
        };

        setState(0);

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          let activeState = 0;

          ScrollTrigger.create({
            trigger: scene,
            start: "top top",
            end: "bottom bottom",
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const nextState = Math.min(caseStates.length - 1, Math.floor(self.progress * caseStates.length));
              if (nextState === activeState) return;
              activeState = nextState;
              setState(nextState);
            },
          });
          return;
        }

        const timeline = gsap.timeline({ defaults: { ease: "power2.inOut" } });
        const copyStateThresholds: number[] = [];
        const stateHoldDuration = 0.8;
        const visualTransitionDuration = 0.32;

        // Give every visible case the same amount of scroll before crossfading.
        timeline.to({}, { duration: stateHoldDuration });

        caseStates.slice(1).forEach((state, transitionIndex) => {
          const fromState = caseStates[transitionIndex];
          const transitionStart = timeline.duration();

          slots.forEach((slot, slotIndex) => {
            const outgoing = slot[fromState[slotIndex]];
            const incoming = slot[state[slotIndex]];
            if (outgoing) timeline.to(outgoing, { opacity: 0, scale: 1.035, duration: visualTransitionDuration }, transitionStart);
            if (incoming) timeline.fromTo(incoming, { opacity: 0, scale: 0.985 }, { opacity: 1, scale: 1, duration: visualTransitionDuration }, transitionStart);
          });

          const outgoingCopy = copyLayersRef.current[transitionIndex];
          const incomingCopy = copyLayersRef.current[transitionIndex + 1];
          if (outgoingCopy) timeline.to(outgoingCopy, { opacity: 0, y: 10, duration: 0.24 }, transitionStart);
          if (incomingCopy) timeline.fromTo(incomingCopy, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.24 }, transitionStart);
          const transitionEnd = timeline.duration();
          copyStateThresholds.push((transitionStart + transitionEnd) / 2);
          timeline.to({}, { duration: stateHoldDuration });
        });

        ScrollTrigger.create({
          animation: timeline,
          trigger: scene,
          start: "top top",
          end: "bottom bottom",
          scrub: 1,
          invalidateOnRefresh: true,
        });

        timeline.eventCallback("onUpdate", () => {
          // Switch the accessible copy at the midpoint of each visual crossfade.
          const nextCopyState = copyStateThresholds.reduce(
            (stateIndex, threshold, index) => (timeline.time() >= threshold ? index + 1 : stateIndex),
            0,
          );
          if (nextCopyState === activeCopyState) return;
          activeCopyState = nextCopyState;
          setCopyAriaState(nextCopyState);
        });
      });
    }, scene);

    return () => {
      revertMedia?.();
      context.revert();
    };
  }, []);

  return (
    <section id="case-lab-3-speakers" className={styles.speakersSection} aria-labelledby="case-lab-3-speakers-title">
      <div className={styles.contentShell}>
        <div className={styles.sectionIntroWide}>
          <h2 id="case-lab-3-speakers-title">Кейсы и спикеры, которые принимали решения.</h2>
          <p>
            Спикеры разбирают собственные кейсы и показывают, как всё происходило изнутри: с какой задачей столкнулись, что решили делать и чем всё закончилось.
          </p>
        </div>

        <div ref={sceneRef} className={styles.speakerScene} aria-hidden="true">
          <div ref={stageRef} className={styles.speakerStage}>
            <div className={styles.speakerStageGrid}>
              <div className={`${styles.speakerStageSlot} ${styles.speakerStageFeature}`}>
                {cases.map((item, caseIndex) => (
                  <figure
                    key={`feature-${item.company}`}
                    ref={(element) => {
                      featureLayersRef.current[caseIndex] = element;
                    }}
                    className={styles.speakerStageCard}
                    aria-hidden="true"
                  >
                    <Image src={item.image} alt="" fill sizes="(max-width: 1100px) 55vw, 58vw" className="object-cover" />
                    <div className={styles.speakerVisualShade} aria-hidden="true" />
                    <figcaption>
                      <span>{item.company}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>

              <div className={styles.speakerStageRail}>
                {[0, 1].map((slotIndex) => (
                  <div key={slotIndex} className={styles.speakerStageSlot}>
                    {cases.map((item, caseIndex) => (
                      <figure
                        key={`${slotIndex}-${item.company}`}
                        ref={(element) => {
                          const layerRefs = slotIndex === 0 ? supportingLayersOneRef : supportingLayersTwoRef;
                          layerRefs.current[caseIndex] = element;
                        }}
                        className={styles.speakerStageCard}
                        aria-hidden="true"
                      >
                        <Image src={item.image} alt="" fill sizes="(max-width: 1100px) 22vw, 24vw" className="object-cover" />
                        <div className={styles.speakerVisualShade} aria-hidden="true" />
                        <figcaption>
                          {item.captionLines.map((line) => <span key={line}>{line}</span>)}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                ))}
              </div>

              <div className={styles.speakerStageCopy}>
                {cases.map((item, caseIndex) => (
                  <article
                    key={`${item.company}-copy`}
                    ref={(element) => {
                      copyLayersRef.current[caseIndex] = element;
                    }}
                    className={styles.speakerStageCopyLayer}
                    aria-hidden={caseIndex !== 0}
                  >
                    <h3>{item.title}</h3>
                    <p className={styles.speakerStageRole}>{item.role}</p>
                    <p>{item.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.speakerSceneSteps} aria-hidden="true">
            {caseStates.map((_, index) => <span key={index} />)}
          </div>
        </div>

          <div className={styles.speakerMobileCases} aria-hidden="true">
          {cases.map((item) => (
            <article key={`mobile-${item.company}`} className={styles.speakerMobileCase}>
              <figure className={styles.speakerMobileVisual} style={{ position: "relative" }}>
                <Image src={item.image} alt={item.alt} fill sizes="100vw" className="object-cover" />
                <div className={styles.speakerVisualShade} aria-hidden="true" />
                <figcaption>
                  <span>{item.company}</span>
                </figcaption>
              </figure>
              <div className={styles.speakerMobileCopy}>
                <h3>{item.title}</h3>
                <p className={styles.speakerMobileRole}>{item.role}</p>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
          </div>

          <div className={styles.speakerAccessibleCases} aria-label="Спикеры и кейсы Case Lab III">
            <ul>
              {cases.map((item) => (
                <li key={`accessible-${item.company}`}>
                  <article>
                    <strong>{item.company}</strong>
                    <span>{item.role}</span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </article>
                </li>
              ))}
            </ul>
          </div>
        </div>
    </section>
  );
}
