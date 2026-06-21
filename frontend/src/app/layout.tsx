import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "DataMind AI", template: "%s · DataMind AI" },
  description: "Upload any data. Get insights instantly.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

