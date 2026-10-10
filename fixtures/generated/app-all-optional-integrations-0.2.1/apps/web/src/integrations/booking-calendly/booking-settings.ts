export type CalendlyBookingSettings = Readonly<{
  destination: string;
  mode: "link" | "inline" | "popup";
}>;

export const bookingCalendlySettings = {
  destination: "https://calendly.com/example/intro",
  mode: "popup",
} as const satisfies CalendlyBookingSettings;
