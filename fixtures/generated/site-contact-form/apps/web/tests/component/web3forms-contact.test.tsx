import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { readContactContent } from "../../src/integrations/contact-form-web3forms/contact-content";

const navigation = vi.hoisted(() => ({ pathname: "/" as string | null }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
const script = vi.hoisted(() => ({ error: undefined as (() => void) | undefined, loaded: undefined as (() => void) | undefined }));
vi.mock("next/script", () => ({ default: (props: { src: string; onError?: () => void; onLoad?: () => void }) => {
  script.error = props.onError; script.loaded = props.onLoad;
  return <span data-testid="captcha-script" data-src={props.src} />;
} }));
const settings = { accessKey: "00000000-0000-4000-8000-000000000001" };
const content = readContactContent("en-CA");
let Web3FormsContact: typeof import("../../src/integrations/contact-form-web3forms/web3forms-contact").Web3FormsContact;
let options: Record<string, unknown>;
const sdk = { render: vi.fn((_container: HTMLElement, value: Record<string, unknown>) => { options = value; return "controlled-widget"; }), reset: vi.fn(), remove: vi.fn() };
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks(); script.error=undefined; script.loaded=undefined;
  vi.stubGlobal("hcaptcha", sdk);
  ({ Web3FormsContact } = await import("../../src/integrations/contact-form-web3forms/web3forms-contact"));
});
afterEach(() => { vi.unstubAllGlobals(); });
const mount = (props: Partial<ComponentProps<typeof Web3FormsContact>> = {}) => render(<Web3FormsContact settings={settings} content={content} locale="en-CA" {...props} />);
async function activate() {
  await userEvent.click(screen.getByRole("button", { name: content.activateCaptchaLabel }));
  await act(async () => { window.egeriaContactCaptchaReady?.(); });
}
async function fill() {
  fireEvent.change(screen.getByLabelText(content.nameLabel), { target: { value: "Synthetic Person" } });
  fireEvent.change(screen.getByLabelText(content.emailLabel), { target: { value: "synthetic@example.invalid" } });
  fireEvent.change(screen.getByLabelText(content.messageLabel), { target: { value: "Controlled message" } });
}
function token() { act(() => { (options.callback as (token: string) => void)("controlled-token"); }); }

describe("contact form", () => {
  it("loads only on activation and waits for SDK readiness instead of script load", async () => {
    mount(); expect(screen.queryByTestId("captcha-script")).toBeNull(); expect(sdk.render).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: content.activateCaptchaLabel }));
    expect((await screen.findByTestId("captcha-script")).getAttribute("data-src")).toContain("render=explicit&recaptchacompat=off");
    act(() => { script.loaded?.(); }); expect(sdk.render).not.toHaveBeenCalled();
    await act(async () => { window.egeriaContactCaptchaReady?.(); });
    expect(sdk.render).toHaveBeenCalledOnce(); expect(options).toMatchObject({hl:"en",sitekey:"50b2fe65-b00b-4b9e-ad62-3ba471098be2"});
  });
  it("labels fields, focuses invalid input and keeps a fallback link", async () => {
    mount(); await userEvent.click(screen.getByRole("button", { name: content.submitLabel }));
    expect(screen.getByLabelText(content.nameLabel)).toHaveFocus();
    expect(screen.getByText(content.nameError)).toBeVisible();
    expect(screen.getByRole("link", { name: content.fallbackLabel })).toHaveAttribute("href", "#contact");
  });
  it("clears corrected field and CAPTCHA errors without clearing other errors", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: content.submitLabel }));
    expect(screen.getByLabelText(content.nameLabel)).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(screen.getByLabelText(content.nameLabel), { target: { value: "Synthetic Person" } });
    expect(screen.getByLabelText(content.nameLabel)).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByText(content.nameError)).toBeNull();
    expect(screen.getByLabelText(content.emailLabel)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(content.captchaError)).toBeVisible();
    await activate(); token();
    expect(screen.queryByText(content.captchaError)).toBeNull();
    expect(screen.getByLabelText(content.emailLabel)).toHaveAttribute("aria-invalid", "true");
  });
  it("allows only one attempt, announces acceptance, clears fields and invalidates CAPTCHA", async () => {
    let finish: (response: Response) => void = () => {};
    const fetch = vi.fn(() => new Promise<Response>(resolve => { finish=resolve; })); vi.stubGlobal("fetch",fetch);
    mount(); await fill(); await activate(); token();
    const form=screen.getByRole("form",{name:content.heading});
    fireEvent.submit(form); fireEvent.submit(form);
    expect(fetch).toHaveBeenCalledOnce();expect(screen.getByRole("button",{name:content.pendingLabel})).toBeDisabled();
    await act(async()=>{finish(Response.json({success:true,message:"private-provider-prose"}));});
    expect(screen.getByRole("status")).toHaveTextContent(content.accepted);
    expect(screen.getByLabelText(content.nameLabel)).toHaveValue("");expect(screen.queryByText("private-provider-prose")).toBeNull();
    expect(sdk.reset).toHaveBeenCalled();expect(sdk.remove).toHaveBeenCalled();
    await fill();fireEvent.submit(form);expect(fetch).toHaveBeenCalledOnce();expect(screen.getByText(content.captchaError)).toBeVisible();
  });
  it("preserves entered values after uncertainty and never retries",async()=>{
    const fetch=vi.fn().mockRejectedValue(new Error("private-response"));vi.stubGlobal("fetch",fetch);
    mount();await fill();await activate();token();await userEvent.click(screen.getByRole("button",{name:content.submitLabel}));
    expect(screen.getByRole("status")).toHaveTextContent(content.unknown);
    expect(screen.getByLabelText(content.nameLabel)).toHaveValue("Synthetic Person");expect(fetch).toHaveBeenCalledOnce();
  });
  it("expires tokens, handles errors, ignores stale callbacks and remounts with the current locale",async()=>{
    const fetch=vi.fn();vi.stubGlobal("fetch",fetch);
    const view=mount();await fill();await activate();token();
    act(()=>{(options["expired-callback"] as ()=>void)();});
    fireEvent.submit(screen.getByRole("form"));expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText(content.captchaExpired)).toBeVisible();
    const oldCallback=options.callback as (value:string)=>void;
    view.rerender(<Web3FormsContact settings={settings} content={readContactContent("fr-CA")} locale="fr-CA" />);
    await waitFor(()=>expect(options.hl).toBe("fr"));
    act(()=>oldCallback("stale-token"));
    fireEvent.submit(screen.getByRole("form"));expect(fetch).not.toHaveBeenCalled();
    act(()=>{(options["error-callback"] as ()=>void)();});
    expect(screen.getByText(readContactContent("fr-CA").captchaUnavailable)).toBeVisible();
    view.unmount();act(()=>oldCallback("late-token"));expect(fetch).not.toHaveBeenCalled();expect(sdk.remove).toHaveBeenCalled();
  });
  it("contains script failure and aborts a request on unmount",async()=>{
    let signal: AbortSignal | undefined;
    const fetch=vi.fn((_url: unknown, init: RequestInit)=>{signal=init.signal as AbortSignal;return new Promise(()=>{});});vi.stubGlobal("fetch",fetch);
    const view=mount();await fill();await userEvent.click(screen.getByRole("button",{name:content.activateCaptchaLabel}));
    act(()=>script.error?.());expect(screen.getByText(content.captchaUnavailable)).toBeVisible();
    await act(async()=>window.egeriaContactCaptchaReady?.());token();fireEvent.submit(screen.getByRole("form"));
    view.unmount();expect(signal?.aborted).toBe(true);expect(fetch).toHaveBeenCalledOnce();
  });
});


describe("home placement", () => {
  it("matches only exact supported homes and preserves a stable empty server render", async () => {
    const { contactHomeLocale, ContactFormPlacement } = await import("../../src/integrations/contact-form-web3forms/contact-form-placement");
    const { renderToString } = await import("react-dom/server");
    expect(renderToString(<ContactFormPlacement multilingual={false} />)).toBe("");
    for (const path of [null, "/about", "/fr-CA/work", "/missing", "/en-CA/missing", "/en-US", "/fr-CAevil"])
      expect(contactHomeLocale(path, true)).toBeUndefined();
    expect(contactHomeLocale("/", false)).toBe("en-CA");
    expect(contactHomeLocale("/fr-CA", false)).toBeUndefined();
    expect(contactHomeLocale("/", true)).toBeUndefined();
    expect(contactHomeLocale("/en-CA/", true)).toBe("en-CA");
    expect(contactHomeLocale("/fr-CA/", true)).toBe("fr-CA");
    navigation.pathname = "/en-CA";
    const view = render(<ContactFormPlacement multilingual={true} />);
    expect(screen.getByRole("form", { name: content.heading })).toBeVisible();
    navigation.pathname = "/en-CA/about"; view.rerender(<ContactFormPlacement multilingual={true} />);
    expect(screen.queryByRole("form")).toBeNull();
    navigation.pathname = "/fr-CA"; view.rerender(<ContactFormPlacement multilingual={true} />);
    expect(screen.getByRole("form", { name: readContactContent("fr-CA").heading })).toBeVisible();
    expect(sdk.render).not.toHaveBeenCalled();
  });
});
