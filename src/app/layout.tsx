import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { FontProvider } from "@/components/settings/FontProvider";

export const metadata: Metadata = {
  title: "RFQ Agent — NorthBridge Automotive",
  description: "Automotive RFQ risk & quote dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Oxanium:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap"
        />
        <Script
          id="theme-prehydrate"
          strategy="beforeInteractive"
        >
          {`(function(){
  try{
    var stored = localStorage.getItem('theme-mode');
    var mode = stored || 'system';
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var shouldDark = mode === 'dark' || (mode === 'system' && prefersDark);
    document.documentElement.classList.toggle('dark', shouldDark);
    var font = localStorage.getItem('ui-font');
    if (font === 'inter' || font === 'source-sans' || font === 'oxanium') {
      document.documentElement.dataset.uiFont = font;
    } else {
      document.documentElement.dataset.uiFont = 'oxanium';
    }
  }catch(e){}
})();`}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <FontProvider>{children}</FontProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
