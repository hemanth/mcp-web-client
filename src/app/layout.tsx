import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "MCPHost — The Universal MCP Client",
  description:
    "Connect to any Model Context Protocol server from your browser. Multi-server support, OAuth 2.0, real-time SSE, built-in LLM chat, and 50+ pre-configured integrations.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MCPHost",
  },
  openGraph: {
    title: "MCPHost — The Universal MCP Client",
    description:
      "Connect to any Model Context Protocol server from your browser. Multi-server support, OAuth 2.0, real-time SSE, and 50+ integrations.",
    url: "https://mcphost.link",
    siteName: "MCPHost",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "MCPHost — The Universal MCP Client",
    description:
      "Connect to any MCP server from your browser. Multi-server, OAuth 2.0, real-time SSE, LLM chat, and 50+ integrations.",
  },
  keywords: [
    "MCP",
    "Model Context Protocol",
    "MCP client",
    "MCP server",
    "AI tools",
    "LLM",
    "OAuth",
    "SSE",
  ],
  authors: [{ name: "Hemanth HM", url: "https://github.com/hemanth" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#050505",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className={`${inter.className} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

