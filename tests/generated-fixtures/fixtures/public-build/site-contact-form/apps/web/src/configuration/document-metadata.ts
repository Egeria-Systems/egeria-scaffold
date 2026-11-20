import type { Metadata } from "next";

export function createDocumentMetadata(origin: string, target: string | undefined): Pick<Metadata, "metadataBase" | "robots"> {
  return {
    metadataBase: new URL(origin),
    ...(target === "production" ? {} : { robots: { index: false, follow: false } }),
  };
}
