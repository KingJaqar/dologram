import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@dologram/shared/src/theme/tokens.css";
import { sans, mono } from "./fonts";
import "./globals.css";
import { ToastProvider } from "../components/Toast/Toast";

export const metadata: Metadata = { title: "DoloGram Admin" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" className={`${sans.variable} ${mono.variable}`}><body><ToastProvider>{children}</ToastProvider></body></html>;
}
