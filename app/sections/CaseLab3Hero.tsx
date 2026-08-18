"use client";

import { ArrowUpRight } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import SpecularButton from "../components/SpecularButton";
import styles from "../case-lab-3/case-lab-3.module.css";
import { caseLab3CheckoutHref } from "../lib/caseLab3";

const Grainient = dynamic(() => import("../components/Grainient"), { ssr: false });

export default function CaseLab3Hero() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className={styles.hero} aria-labelledby="case-lab-3-title">
      <div className={styles.heroShell}>
        <div className={`${styles.caseRoomShape} ${shouldReduceMotion ? styles.caseRoomShapeStatic : ""}`}>
          <div className={styles.caseRoomGradient} aria-hidden="true">
            {!shouldReduceMotion && (
              <Grainient
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
            )}
          </div>
          <div className={styles.caseRoomShapeContent}>
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
              <span>СЕНТЯБРЯ<br />NARXOZ BUSINESS SCHOOL</span>
            </div>
            <div className={styles.caseRoomPurchase}>
              <SpecularButton
                size="lg"
                radius={999}
                tint="#ffffff"
                tintOpacity={1}
                textColor="#160f43"
                lineColor="#040082"
                baseColor="#afa8ff"
                intensity={1}
                shineSize={10}
                shineFade={40}
                thickness={3}
                speed={0.35}
                followMouse
                proximity={250}
                autoAnimate={false}
                className={styles.heroCta}
                style={{ padding: "14px 76px", fontSize: "16px" }}
                onClick={() => window.location.assign(caseLab3CheckoutHref)}
              >
                Купить билет
                <ArrowUpRight size={20} strokeWidth={2} aria-hidden="true" />
              </SpecularButton>
              <p>Первые 20 билетов — 7 890 ₸.<br />Далее — 15 000 ₸.</p>
            </div>
          </div>
        </div>

        <div className={styles.caseRoomCases}>
          <div className={styles.caseRoomCase}>
            <Image src="/Invictus GO.webp" alt="" fill sizes="(max-width: 640px) 100vw, 33vw" aria-hidden="true" />
            <strong>Invictus GO</strong>
            <span className={styles.caseRoomCaseFeaturedDescription}>Масштабирование сети фитнес-клубов</span>
            <span className={styles.caseRoomCaseArrow} aria-hidden="true">
              <ArrowUpRight size={22} strokeWidth={2} />
            </span>
          </div>
          <div className={styles.caseRoomCase}>
            <Image src="/OYU Fest 2026.webp" alt="" fill sizes="(max-width: 640px) 100vw, 33vw" aria-hidden="true" />
            <strong>Qara Studios</strong>
            <span className={styles.caseRoomCaseFeaturedDescription}>Что сработало в продвижении OYU Fest?</span>
            <span className={styles.caseRoomCaseArrow} aria-hidden="true">
              <ArrowUpRight size={22} strokeWidth={2} />
            </span>
          </div>
          <div className={styles.caseRoomCase}>
            <Image src="/ForteXGForce.webp" alt="" fill sizes="(max-width: 640px) 100vw, 33vw" aria-hidden="true" />
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
