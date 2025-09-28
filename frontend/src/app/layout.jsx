import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { Toast } from "@/components/ui/toast"
import { ProjectProvider } from "@/contexts/project-context"
import { AuthProvider } from "@/hooks/useAuth"
import "./globals.css"

export const metadata = {
  title: "G3T5 Project Timeline",
  description: "Project management timeline interface",
  generator: "v0.app",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <AuthProvider>
          <ProjectProvider>
            <Suspense fallback={null}>{children}</Suspense>
            <Toast />
          </ProjectProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
