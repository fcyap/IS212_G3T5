import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { Toaster } from "react-hot-toast"
import "./globals.css"

export const metadata = {
  title: "Asana Project Timeline",
  description: "Project management timeline interface",
  generator: "v0.app",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <Suspense fallback={null}>{children}</Suspense>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1f1f23',
              color: '#fff',
              border: '1px solid #374151',
            },
          }}
        />
        <Analytics />
      </body>
    </html>
  )
}
