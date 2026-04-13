import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "School Connect - School-Parent Communication Platform",
  description: "A modern SaaS platform for seamless communication between schools and parents",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "School Connect",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f6f8' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1720' },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value;
  const htmlLang = localeCookie === 'fr' || localeCookie === 'sw' || localeCookie === 'en'
    ? localeCookie
    : 'en';
  
  return (
    <html lang={htmlLang} data-theme="light">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('ui-theme') || 'light';
                const themeColorMap = {
                  light: '#f5f6f8',
                  dark: '#0f1720',
                  calm: '#f5f8f5',
                };
                document.documentElement.setAttribute('data-theme', theme);
                document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
                const metaTheme = document.querySelector('meta[name="theme-color"]');
                if (metaTheme) {
                  metaTheme.setAttribute('content', themeColorMap[theme] || themeColorMap.light);
                }
                document.documentElement.classList.add('theme-transition');
              } catch {}
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
