import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { Toast } from "@/components/ui/toast"
import { ProjectProvider } from "@/contexts/project-context"
import { AuthProvider } from "@/hooks/useAuth"
import { SessionProvider } from "@/components/session-provider"
import { DeadlineNotificationToaster } from "@/components/deadline-notification-toaster"
import ErrorBoundary from "@/components/error-boundary"
import "./globals.css"

export const metadata = {
  title: "G3T5 Project Timeline",
  description: "Project management timeline interface",
  generator: "v0.app",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
      </head>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <ErrorBoundary>
          <SessionProvider>
            <AuthProvider>
              <ProjectProvider>
                <Suspense fallback={null}>{children}</Suspense>
                <Toast />
                <DeadlineNotificationToaster />
              </ProjectProvider>
            </AuthProvider>
          </SessionProvider>
        </ErrorBoundary>
        <Analytics />
      </body>
    </html>
  )
}
