import { afterEach, describe, expect, it, vi } from "vitest";
import { submitContact, validateContactFields } from "../../src/integrations/contact-form-web3forms/submit-contact";

const settings = { accessKey: "00000000-0000-4000-8000-000000000001" };
const fields = { name: "Synthetic Person", email: "synthetic@example.invalid", message: "Controlled contact message" };
const input = () => ({ settings, fields, subject: "Controlled subject", captchaToken: "controlled-token", signal: new AbortController().signal });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("contact transport", () => {
  it.each([
    ["name", ""], ["name", " "] , ["name", "n".repeat(121)],
    ["email", "not-an-address"], ["email", "a@b.invalid\nother@example.invalid"], ["email", "a".repeat(254)+"@example.invalid"],
    ["message", "\n "], ["message", "m".repeat(5001)],
  ])("refuses invalid %s without a request", async (field, value) => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(await submitContact({ ...input(), fields: { ...fields, [field]: value } })).toEqual({kind:"invalid",field});
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requires a CAPTCHA token and trims field boundaries", async () => {
    const fetch = vi.fn();vi.stubGlobal("fetch",fetch);
    expect(await submitContact({...input(),captchaToken:""})).toEqual({kind:"invalid",field:"captcha"});
    expect(fetch).not.toHaveBeenCalled();
    expect(validateContactFields({...fields,name:" Name ",message:" Message "})).toEqual({});
  });
  it("sends only approved fields once with privacy and redirect controls", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({success:true,message:"ignored provider prose",data:fields}));
    vi.stubGlobal("fetch",fetch);
    expect(await submitContact({...input(),fields:{...fields,name:" Name ",message:" Message ",secret:"not-for-provider"} as typeof fields})).toEqual({kind:"accepted"});
    expect(fetch).toHaveBeenCalledOnce();
    const [url,options] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.web3forms.com/submit");
    expect(options).toMatchObject({method:"POST",credentials:"omit",referrerPolicy:"no-referrer",redirect:"error",headers:{"Content-Type":"application/json"} });
    expect(JSON.parse(options.body)).toEqual({access_key:settings.accessKey,name:"Name",email:fields.email,message:"Message",subject:"Controlled subject","h-captcha-response":"controlled-token"});
  });
  it.each([
    [200,{success:true},"accepted"], [200,{success:false},"rejected"], [200,{success:"true"},"unknown"],
    [200,[],"unknown"], [200,null,"unknown"], [400,{success:true},"rejected"], [403,{},"rejected"], [422,{},"rejected"],
    [429,{},"rate-limited"], [500,{success:true},"unknown"], [503,{},"unknown"],
  ])("normalizes HTTP %s and %j without provider prose",async(status,body,kind)=>{
    const fetch=vi.fn().mockResolvedValue(Response.json(body,{status}));vi.stubGlobal("fetch",fetch);
    expect(await submitContact(input())).toEqual({kind});expect(fetch).toHaveBeenCalledOnce();
  });
  it.each(["not JSON", " ".repeat(16385), JSON.stringify({success:true,padding:"é".repeat(8192)})])("bounds and validates the response body",async body=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(body)));
    expect(await submitContact(input())).toEqual({kind:"unknown"});
  });
  it("cancels an oversized stream",async()=>{
    const cancel=vi.fn();const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(16385));},cancel});
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(stream)));
    expect(await submitContact(input())).toEqual({kind:"unknown"});expect(cancel).toHaveBeenCalledOnce();
  });
  it.each(["headers","body"])("enforces one deadline through stalled %s with no retry",async phase=>{
    vi.useFakeTimers();const cancel=vi.fn();
    const fetch=vi.fn().mockImplementation(()=>phase==="headers"?new Promise(()=>{}):Promise.resolve(new Response(new ReadableStream({cancel}))));
    vi.stubGlobal("fetch",fetch);const result=submitContact(input());
    await vi.advanceTimersByTimeAsync(15000);
    expect(await result).toEqual({kind:"unknown"});expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]![1].signal.aborted).toBe(true);
    if(phase==="body")expect(cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("contains network errors without retry or exception details",async()=>{
    const fetch=vi.fn().mockRejectedValue(new Error("private-response"));vi.stubGlobal("fetch",fetch);
    expect(await submitContact(input())).toEqual({kind:"unknown"});expect(fetch).toHaveBeenCalledOnce();
  });
  it("refuses an already aborted attempt and cancels an active one",async()=>{
    const fetch=vi.fn().mockImplementation(()=>new Promise(()=>{}));vi.stubGlobal("fetch",fetch);
    const controller=new AbortController();controller.abort();
    expect(await submitContact({...input(),signal:controller.signal})).toEqual({kind:"unknown"});expect(fetch).not.toHaveBeenCalled();
    const active=new AbortController();const result=submitContact({...input(),signal:active.signal});active.abort();
    expect(await result).toEqual({kind:"unknown"});expect(fetch).toHaveBeenCalledOnce();
  });
});


describe("contact copy", () => {
  it("validates both locales and rejects missing, unknown or unsafe subject copy", async () => {
    const { readContactContent, parseContactContent } = await import("../../src/integrations/contact-form-web3forms/contact-content");
    const english = readContactContent("en-CA");
    const french = readContactContent("fr-CA");
    expect(Object.keys(english)).toEqual(Object.keys(french));
    expect(english.heading).not.toBe(french.heading);
    const missing = Object.fromEntries(Object.entries(english).filter(([key]) => key !== "heading"));
    expect(() => parseContactContent(missing)).toThrow("CONTACT_CONTENT_INVALID");
    for (const value of [{...english, unexpected: "value"}, {...english, heading: " "}, {...english, subject: "a\nb"}, {...english, subject: "a".repeat(121)}])
      expect(() => parseContactContent(value)).toThrow("CONTACT_CONTENT_INVALID");
  });
});
