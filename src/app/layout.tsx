import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MCP Web Client",
  description: "Connect to remote MCP servers with OAuth authentication support",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
