import type { Metadata } from "next";

import LiveParticipantClient from "./LiveParticipantClient";
import styles from "./live.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Live | Case Lab III",
  description: "Ответьте на вопрос кейса и следите за результатами Case Lab III.",
  robots: { index: false, follow: false },
};

export default function CaseLab3LivePage() {
  return (
    <main className={styles.page}>
      <LiveParticipantClient />
    </main>
  );
}
