"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { readContactContent, type ContactLocale } from "./contact-content";
import { contactSettings } from "./contact-settings";
import { Web3FormsContact } from "./web3forms-contact";

export function contactHomeLocale(pathname: string | null, multilingual: boolean): ContactLocale | undefined {
  if (!multilingual) return pathname === "/" ? "en-CA" : undefined;
  if (pathname === "/en-CA" || pathname === "/en-CA/") return "en-CA";
  if (pathname === "/fr-CA" || pathname === "/fr-CA/") return "fr-CA";
  return undefined;
}

const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function ContactFormPlacement({ multilingual }: Readonly<{ multilingual: boolean }>) {
  const pathname = usePathname();
  const mounted = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  const locale = mounted ? contactHomeLocale(pathname, multilingual) : undefined;
  return locale === undefined ? null : (
    <Web3FormsContact key={locale} locale={locale} content={readContactContent(locale)} settings={contactSettings} />
  );
}
