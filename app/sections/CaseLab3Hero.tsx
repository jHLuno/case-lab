"use client";

import { ArrowUpRight } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { useState } from "react";
import styles from "../case-lab-3/case-lab-3.module.css";
import GrainientBoundary from "../components/GrainientBoundary";

const Grainient = dynamic(() => import("../components/Grainient"), { ssr: false });

export default function CaseLab3Hero() {
  const shouldReduceMotion = useReducedMotion();
  const [grainientFailed, setGrainientFailed] = useState(false);

  return (
    <section className={styles.hero} aria-labelledby="case-lab-3-title">
      <div className={styles.heroShell}>
        <div className={`${styles.caseRoomShape} ${shouldReduceMotion ? styles.caseRoomShapeStatic : ""}`}>
          <div className={styles.caseRoomGradient} aria-hidden="true">
            {!shouldReduceMotion && !grainientFailed && (
              <GrainientBoundary>
                <Grainient
                  onError={() => setGrainientFailed(true)}
                  color1="#eb9ae9"
                  color2="#040082"
                  color3="#ab6ae9"
                  timeSpeed={1.6}
                  colorBalance={-0.5}
                  warpStrength={0.7}
                  warpFrequency={3.4}
                  warpSpeed={0.3}
                  warpAmplitude={20}
                  blendAngle={-23}
                  blendSoftness={0}
                  rotationAmount={210}
                  noiseScale={2}
                  grainAmount={0.1}
                  grainScale={2}
                  grainAnimated={false}
                  contrast={1.5}
                  gamma={1}
                  saturation={1}
                  centerX={0}
                  centerY={0}
                  zoom={0.9}
                />
              </GrainientBoundary>
            )}
          </div>
          <div className={`${styles.caseRoomShapeContent} ${styles.caseLabHeroHeading}`}>
            <p className={styles.caseRoomKicker}>
              <span className={styles.caseRoomBrand}>
                Case Lab <span className={styles.caseRoomRoman}>III</span>
              </span>
            </p>
            <h1 id="case-lab-3-title" className={styles.caseRoomTitle}>
              <span>Как это было</span>
              <span>сделано на самом деле</span>
            </h1>
            <p className={styles.caseRoomCopy}>
              Внутренняя кухня трёх казахстанских маркетинговых кейсов. Что происходило внутри, какие решения принимали и к чему они привели.
            </p>
          </div>
          <div className={styles.caseRoomShapeFooter}>
            <div className={styles.caseRoomDetails}>
              <strong>24</strong>
              <span>
                СЕНТЯБРЯ<br />
                10:00–14:00<br />
                NARXOZ BUSINESS SCHOOL
              </span>
            </div>
            <div className={styles.caseRoomPurchase}>
              <button type="button" className={styles.heroCta} aria-disabled="true">
                Купить билет
                <ArrowUpRight size={20} strokeWidth={2} aria-hidden="true" />
              </button>
              <p>Первые 20 билетов — 7 890 ₸.<br />Далее — 15 000 ₸.</p>
            </div>
          </div>
        </div>

        <div className={styles.caseRoomCases}>
          <div className={styles.caseRoomCase} style={{ position: "relative" }}>
            <Image src="/Invictus GO.webp" alt="" fill loading="eager" sizes="(max-width: 640px) 100vw, 33vw" aria-hidden="true" />
            <strong>Invictus GO</strong>
            <span className={styles.caseRoomCaseFeaturedDescription}>Масштабирование сети фитнес-клубов</span>
            <span className={styles.caseRoomCaseArrow} aria-hidden="true">
              <ArrowUpRight size={22} strokeWidth={2} />
            </span>
          </div>
          <div className={styles.caseRoomCase} style={{ position: "relative" }}>
            <Image src="/OYU Fest 2026.webp" alt="" fill loading="lazy" sizes="(max-width: 640px) 100vw, 33vw" aria-hidden="true" />
            <strong>Qara Studios</strong>
            <span className={styles.caseRoomCaseFeaturedDescription}>Что сработало в продвижении OYU Fest?</span>
            <span className={styles.caseRoomCaseArrow} aria-hidden="true">
              <ArrowUpRight size={22} strokeWidth={2} />
            </span>
          </div>
          <div className={styles.caseRoomCase} style={{ position: "relative" }}>
            <Image src="/ForteXGForce.webp" alt="" fill loading="lazy" sizes="(max-width: 640px) 100vw, 33vw" aria-hidden="true" />
            <strong>Forte Bank × GForce Grey</strong>
            <span className={styles.caseRoomCaseFeaturedDescription}>Как история<br />стала арт-объектом?</span>
            <span className={styles.caseRoomCaseArrow} aria-hidden="true">
              <ArrowUpRight size={22} strokeWidth={2} />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
