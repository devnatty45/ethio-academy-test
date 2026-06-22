// app/layout.tsx
// Root layout — wraps every page in the application
// Accessible to: everyone

import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "School Registration System",
  description: "Online enrollment platform",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
