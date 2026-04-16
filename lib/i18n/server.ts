import { cookies } from "next/headers";

import {
  defaultLocale,
  hasLocale,
  localeCookieName,
  type Locale,
} from "./config";

export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(localeCookieName)?.value;

  return cookieLocale && hasLocale(cookieLocale) ? cookieLocale : defaultLocale;
}
