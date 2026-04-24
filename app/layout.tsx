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
  title: "School Connect - School-Parent Communication Platform",
  description: "A modern SaaS platform for seamless communication between schools and parents",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "School Connect",
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
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:FILL,wght,GRAD,opsz@0..1,100..700,-50..200,20..48"
        />
        <meta name="theme-color" content={initialThemeColor} />
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
                document.cookie = 'ui-theme=' + encodeURIComponent(theme) + '; path=/; max-age=31536000; SameSite=Lax';
                document.querySelectorAll('meta[name="theme-color"]').forEach((metaTheme) => {
                  metaTheme.setAttribute('content', themeColorMap[theme] || themeColorMap.light);
                });
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
