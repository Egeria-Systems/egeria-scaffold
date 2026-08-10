"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";

import type { BookingContent } from "./booking-content";
import type { CalendlyBookingSettings } from "./booking-settings";

export type CalendlyBookingProperties = Readonly<{
  settings: CalendlyBookingSettings;
  copy: BookingContent;
}>;

type BookingFrameProperties = Readonly<{
  settings: CalendlyBookingSettings;
  copy: BookingContent;
}>;

function BookingFrame({ settings, copy }: BookingFrameProperties) {
  return (
    <iframe
      data-testid="booking-frame"
      src={settings.destination}
      title={copy.frameTitle}
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      className="h-[44rem] w-full max-w-4xl rounded-lg border border-line bg-surface"
    />
  );
}

export function CalendlyBooking({
  settings,
  copy,
}: CalendlyBookingProperties) {
  const inlineRegionReference = useRef<HTMLDivElement>(null);
  const dialogReference = useRef<HTMLDialogElement>(null);
  const [frameActive, setFrameActive] = useState(false);

  useEffect(() => {
    if (settings.mode !== "inline" || frameActive) {
      return;
    }

    const region = inlineRegionReference.current;
    if (region === null) {
      return;
    }

    if (typeof window.IntersectionObserver !== "function") {
      const activationFrame = window.requestAnimationFrame(() => {
        setFrameActive(true);
      });

      return () => window.cancelAnimationFrame(activationFrame);
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        if (entries.some(({ isIntersecting }) => isIntersecting)) {
          setFrameActive(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(region);

    return () => observer.disconnect();
  }, [frameActive, settings.mode]);

  const activatePopup = (event: MouseEvent<HTMLAnchorElement>): void => {
    const dialog = dialogReference.current;

    if (
      settings.mode !== "popup" ||
      dialog === null ||
      typeof dialog.showModal !== "function"
    ) {
      return;
    }

    event.preventDefault();
    setFrameActive(true);
    dialog.showModal();
  };

  const closePopup = (): void => {
    dialogReference.current?.close();
  };

  const bookingLink = (
    <a
      data-testid="booking-link"
      href={settings.destination}
      onClick={settings.mode === "popup" ? activatePopup : undefined}
      className="inline-flex min-h-12 min-w-11 items-center justify-center rounded-md bg-accent py-3 pe-5 ps-5 font-semibold text-accent-contrast underline decoration-2 underline-offset-4 hover:bg-accent-hover"
    >
      {copy.linkLabel}
    </a>
  );

  return (
    <section
      aria-labelledby="booking-heading"
      className="rounded-xl border border-line bg-surface p-6 shadow-sm sm:p-8"
    >
      <div className="flex max-w-3xl flex-col items-start gap-4">
        <h2 id="booking-heading" className="text-3xl font-bold tracking-tight">
          {copy.heading}
        </h2>
        <p className="text-lg text-muted">{copy.summary}</p>
        {bookingLink}
      </div>

      {settings.mode === "link" ? null : settings.mode === "inline" ? (
        <div
          ref={inlineRegionReference}
          data-testid="booking-inline-region"
          className="mt-8 flex w-full justify-center overflow-hidden"
        >
          {frameActive ? (
            <BookingFrame settings={settings} copy={copy} />
          ) : null}
        </div>
      ) : (
        <dialog
          ref={dialogReference}
          data-testid="booking-dialog"
          aria-labelledby="booking-dialog-heading"
          onClose={() => setFrameActive(false)}
          className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl overflow-auto rounded-xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/60"
        >
          <div className="flex items-center justify-between gap-4 border-b border-line p-4 sm:p-6">
            <h2
              id="booking-dialog-heading"
              className="text-2xl font-bold tracking-tight"
            >
              {copy.popupHeading}
            </h2>
            <button
              type="button"
              onClick={closePopup}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-line py-2 pe-3 ps-3 font-semibold text-accent underline decoration-2 underline-offset-4 hover:text-accent-hover"
            >
              {copy.closeLabel}
            </button>
          </div>
          {frameActive ? (
            <BookingFrame settings={settings} copy={copy} />
          ) : null}
        </dialog>
      )}
    </section>
  );
}
