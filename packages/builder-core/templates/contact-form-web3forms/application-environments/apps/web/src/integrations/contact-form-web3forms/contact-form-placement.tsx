"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { readContactContent, type ContactLocale } from "./contact-content";
import { readContactSettings } from "./contact-settings";
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
  if (locale === undefined) return null;
  const content = readContactContent(locale);
  const settings = readContactSettings();
  return settings === undefined ? (
    <section id="contact-form" aria-labelledby="contact-form-heading" className="ps-4 pe-4 py-8 sm:ps-6 sm:pe-6 lg:ps-8 lg:pe-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <h2 id="contact-form-heading" className="text-2xl font-bold">{content.heading}</h2>
        <p>{content.unavailable}</p>
        <a href="#contact" className="min-h-11 self-start py-3 font-semibold text-accent underline decoration-2 underline-offset-4">{content.fallbackLabel}</a>
      </div>
    </section>
  ) : <Web3FormsContact key={locale} locale={locale} content={content} settings={settings} />;
}
