import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { ContactFormPlacement } from "../../src/integrations/contact-form-web3forms/contact-form-placement";
import { readContactContent } from "../../src/integrations/contact-form-web3forms/contact-content";

const navigation = vi.hoisted(() => ({ pathname: "/en-CA" as string | null }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
const provider = vi.hoisted(() => ({ scripts: vi.fn() }));
vi.mock("next/script", () => ({ default: () => { provider.scripts(); return null; } }));
const fetch = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetch);
  vi.stubEnv("NEXT_PUBLIC_APPLICATION_ENVIRONMENT", "development");
  vi.stubEnv("NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY", "");
  navigation.pathname = "/en-CA";
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("contact availability", () => {
  it("renders localized unavailable homes and fallback without provider activation", () => {
    expect(renderToString(<ContactFormPlacement multilingual={true} />)).toBe("");
    const view = render(<ContactFormPlacement multilingual={true} />);
    for (const locale of ["en-CA", "fr-CA"] as const) {
      navigation.pathname = `/${locale}`;
      view.rerender(<ContactFormPlacement multilingual={true} />);
      const content = readContactContent(locale);
      expect(screen.getByRole("region", { name: content.heading })).toBeVisible();
      expect(screen.queryByRole("form")).toBeNull();
      expect(screen.getByText(content.unavailable)).toBeVisible();
      expect(screen.getByRole("link", { name: content.fallbackLabel })).toHaveAttribute("href", "#contact");
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByRole("textbox")).toBeNull();
    }
    for (const pathname of [null, "/", "/fr-CA/about", "/en-CA/missing", "/fr-CAevil"]) {
      navigation.pathname = pathname;
      view.rerender(<ContactFormPlacement multilingual={true} />);
      expect(view.container).toBeEmptyDOMElement();
    }
    navigation.pathname = "/";
    view.rerender(<ContactFormPlacement multilingual={false} />);
    expect(screen.getByText(readContactContent("en-CA").unavailable)).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
    expect(provider.scripts).not.toHaveBeenCalled();
  });
  it("mounts the existing form only when configured and keeps CAPTCHA activation explicit", () => {
    vi.stubEnv("NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY", "00000000-0000-4000-8000-000000000001");
    const view = render(<ContactFormPlacement multilingual={true} />);
    expect(screen.getByRole("form", { name: readContactContent("en-CA").heading })).toBeVisible();
    navigation.pathname = "/fr-CA";
    view.rerender(<ContactFormPlacement multilingual={true} />);
    expect(screen.getByRole("form", { name: readContactContent("fr-CA").heading })).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
    expect(provider.scripts).not.toHaveBeenCalled();
  });
});
