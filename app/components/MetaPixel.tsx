"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const META_PIXEL_ID = "1317409210320189";
const META_PIXEL_PATHS = new Set(["/", "/case-lab-3"]);

type MetaPixelWindow = Window & {
  fbq?: (...args: unknown[]) => void;
};

const metaPixelBootstrap = `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');`;

function normalizePathname(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export default function MetaPixel({ nonce }: { nonce?: string }) {
  const pathname = usePathname();
  const normalizedPathname = normalizePathname(pathname);
  const enabled = META_PIXEL_PATHS.has(normalizedPathname);
  const [ready, setReady] = useState(false);
  const lastTrackedPathname = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      lastTrackedPathname.current = null;
      return;
    }

    if (!ready || lastTrackedPathname.current === normalizedPathname) return;

    const fbq = (window as MetaPixelWindow).fbq;
    if (typeof fbq !== "function") return;

    fbq("track", "PageView");
    lastTrackedPathname.current = normalizedPathname;
  }, [enabled, normalizedPathname, ready]);

  if (!enabled) return null;

  return (
    <Script
      id="meta-pixel"
      nonce={nonce}
      strategy="afterInteractive"
      onReady={() => setReady(true)}
      dangerouslySetInnerHTML={{ __html: metaPixelBootstrap }}
    />
  );
}
