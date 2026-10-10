import type { Metadata } from "next";
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
  applicationName: "Azelio",
  title: "Azelio — School Management, Simplified.",
  description:
    "Azelio is school management software for African schools — attendance, results, fees, and communication in one place.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Azelio",
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value;
  const themeCookie = cookieStore.get('ui-theme')?.value;
  const htmlLang = localeCookie === 'fr' || localeCookie === 'sw' || localeCookie === 'en'
    ? localeCookie
    : 'en';
  const initialTheme = themeCookie === 'dark' || themeCookie === 'calm' || themeCookie === 'light'
    ? themeCookie
    : 'light'
  const initialThemeColor = initialTheme === 'dark'
    ? '#0f1720'
    : initialTheme === 'calm'
      ? '#f5f8f5'
      : '#f5f6f8'
  
  return (
    <html lang={htmlLang} data-theme={initialTheme} style={{ colorScheme: initialTheme === 'dark' ? 'dark' : 'light' }}>
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:FILL,wght,GRAD,opsz@0..1,100..700,-50..200,20..48"
        />
        <meta name="theme-color" content={initialThemeColor} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var allowed = { light: 1, dark: 1, calm: 1 };
                var stored = null;
                try { stored = localStorage.getItem('ui-theme'); } catch (e) {}
                var cookieMatch = document.cookie.match(/(?:^|;\\s*)ui-theme=([^;]*)/);
                var cookieTheme = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
                var attrTheme = document.documentElement.getAttribute('data-theme');
                var theme = [stored, cookieTheme, attrTheme].find(function (value) {
                  return value && allowed[value];
                }) || 'light';
                var themeColorMap = {
                  light: '#f5f6f8',
                  dark: '#0f1720',
                  calm: '#f5f8f5',
                };
                document.documentElement.setAttribute('data-theme', theme);
                document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
                document.cookie = 'ui-theme=' + encodeURIComponent(theme) + '; path=/; max-age=31536000; SameSite=Lax';
                try { localStorage.setItem('ui-theme', theme); } catch (e) {}
                document.querySelectorAll('meta[name="theme-color"]').forEach(function (metaTheme) {
                  metaTheme.setAttribute('content', themeColorMap[theme] || themeColorMap.light);
                });
                document.documentElement.classList.add('theme-transition');
              } catch (e) {}
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
