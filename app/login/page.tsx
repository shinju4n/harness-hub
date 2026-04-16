import { Suspense } from "react";
import LoginForm from "@/components/login-form";
import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const dictionary = await getDictionary(locale);

  return {
    title: `${dictionary.login.submit} - Harness Hub`,
  };
}

export default async function LoginPage() {
  const locale = await getRequestLocale();
  const dictionary = await getDictionary(locale);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-100">
            {dictionary.login.title}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {dictionary.login.subtitle}
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
