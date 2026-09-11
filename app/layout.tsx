import type { Metadata } from "next";
import { AdminShell } from "./AdminShell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Store Manager — Haley Wali",
    template: "%s — Haley Wali Store Manager",
  },
  description: "Manage Haley Wali articles, supplier imports and customer orders.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body><AdminShell>{children}</AdminShell></body>
    </html>
  );
}
