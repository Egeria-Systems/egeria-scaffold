import { NextRequest, NextResponse } from "next/server";

import {
  isLocale,
  localizePath,
  looksLikeLocaleSegment,
  negotiateLocale,
} from "./src/i18n/locale";

const localeHeader = "x-egeria-locale";

export function middleware(request: NextRequest): NextResponse {
  const firstSegment = request.nextUrl.pathname.split("/")[1] ?? "";

  if (isLocale(firstSegment)) {
    const headers = new Headers(request.headers);
    headers.set(localeHeader, firstSegment);
    return NextResponse.next({ request: { headers } });
  }

  if (looksLikeLocaleSegment(firstSegment)) {
    return NextResponse.next();
  }

  const locale = negotiateLocale(request.headers.get("accept-language"));
  const destination = request.nextUrl.clone();
  destination.pathname = localizePath(locale, destination.pathname);
  const response = NextResponse.redirect(destination);
  response.headers.set("Vary", "Accept-Language");
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
