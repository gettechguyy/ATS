import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** True when pathname matches a nav route (avoids /submissions matching /submissions-vendor). */
export function isNavLinkActive(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/";
  if (pathname === to) return true;
  if (!pathname.startsWith(to)) return false;
  const next = pathname[to.length];
  return next === undefined || next === "/";
}

/** Base URL for invite/email links. Use VITE_APP_URL in production so links point to your published app. */
export function getAppBaseUrl(): string {
  const envUrl = import.meta.env.VITE_APP_URL as string | undefined;
  if (envUrl) return envUrl.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}
