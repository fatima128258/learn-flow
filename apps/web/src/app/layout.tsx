import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "../providers/QueryProvider";
import { ToastProvider } from "../components/ui/ToastProvider";
import { SkipLink } from "../components/layout/SkipLink";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "LearnFlow - Transform Learning into Growth",
    template: "%s | LearnFlow",
  },
  description: "A comprehensive learning management and digital commerce platform for students, instructors, and organizations to create, share, and monetize knowledge.",
  keywords: ["learning management system", "LMS", "online courses", "e-learning", "education platform", "digital commerce", "course marketplace"],
  authors: [{ name: "LearnFlow" }],
  creator: "LearnFlow",
  publisher: "LearnFlow",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "LearnFlow",
    title: "LearnFlow - Transform Learning into Growth",
    description: "A comprehensive learning management and digital commerce platform for students, instructors, and organizations.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "LearnFlow",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LearnFlow - Transform Learning into Growth",
    description: "A comprehensive learning management and digital commerce platform for students, instructors, and organizations.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SkipLink />
        <QueryProvider>
          <ToastProvider>{children}</ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
