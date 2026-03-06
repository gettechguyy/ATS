import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Base URL for invite/email links. Use VITE_APP_URL in production so links point to your published app. */
export function getAppBaseUrl(): string {
  const envUrl = import.meta.env.VITE_APP_URL as string | undefined;
  if (envUrl) return envUrl.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}
