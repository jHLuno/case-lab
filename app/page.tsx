import { headers } from "next/headers";
import HomePage from "./components/HomePage";
import GoogleTagManager from "./components/GoogleTagManager";
import ServiceJsonLd from "./components/ServiceJsonLd";

export default async function Home() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <>
      <GoogleTagManager nonce={nonce} />
      <ServiceJsonLd />
      <HomePage />
    </>
  );
}
