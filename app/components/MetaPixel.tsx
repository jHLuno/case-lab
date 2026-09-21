"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const META_PIXEL_ID = "1317409210320189";
const META_PIXEL_PATHS = new Set(["/", "/case-lab-3"]);

type MetaPixelWindow = Window & {
  fbq?: (...args: unknown[]) => void;
  __caseLabMetaPixelPageViewPath?: string;
};

const metaPixelBootstrap = `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
window.__caseLabMetaPixelPageViewPath = window.location.pathname.length > 1
  ? window.location.pathname.replace(/\\/+$/, '')
  : window.location.pathname;
fbq('track', 'PageView');`;

function normalizePathname(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function trackMetaPixelEvent(eventName: "Lead"): void {
  if (typeof window === "undefined") return;

  const pathname = normalizePathname(window.location.pathname);
  if (!META_PIXEL_PATHS.has(pathname)) return;

  const fbq = (window as MetaPixelWindow).fbq;
  if (typeof fbq === "function") fbq("track", eventName);
}

export default function MetaPixel({ nonce }: { nonce?: string }) {
  const pathname = usePathname();
  const normalizedPathname = normalizePathname(pathname);
  const enabled = META_PIXEL_PATHS.has(normalizedPathname);
  const lastTrackedPathname = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      lastTrackedPathname.current = null;
      return;
    }

    if (lastTrackedPathname.current === normalizedPathname) return;

    const metaPixelWindow = window as MetaPixelWindow;
    if (metaPixelWindow.__caseLabMetaPixelPageViewPath === normalizedPathname) {
      lastTrackedPathname.current = normalizedPathname;
      return;
    }

    const fbq = metaPixelWindow.fbq;
    if (typeof fbq !== "function") return;

    fbq("track", "PageView");
    metaPixelWindow.__caseLabMetaPixelPageViewPath = normalizedPathname;
    lastTrackedPathname.current = normalizedPathname;
  }, [enabled, normalizedPathname]);

  if (!enabled) return null;

  return (
    <Script
      id="meta-pixel"
      nonce={nonce}
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: metaPixelBootstrap }}
    />
  );
}
