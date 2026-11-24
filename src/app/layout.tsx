import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "OpenSourceHQ — Open Source Mentorship Platform",
  description: "Enterprise-grade mentorship management platform for open-source organizations, mentors, and mentees.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('oshq-theme') || 'dark';
                if (theme === 'light') {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.style.colorScheme = 'light';
                } else {
                  document.documentElement.classList.add('dark');
                  document.documentElement.style.colorScheme = 'dark';
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="bg-background text-foreground antialiased min-h-screen">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

