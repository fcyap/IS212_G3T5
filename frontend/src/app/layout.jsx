import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { Toast } from "@/components/ui/toast"
import { ProjectProvider } from "@/contexts/project-context"
import { SettingsProvider } from "@/contexts/settings-context"
import { NotificationProvider } from "@/contexts/notification-context"
import { AuthProvider } from "@/hooks/useAuth"
import { SessionProvider } from "@/components/session-provider"
import { DeadlineNotificationToaster } from "@/components/deadline-notification-toaster"
import ErrorBoundary from "@/components/error-boundary"
import "./globals.css"
import "@/styles/themes.css"

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
          <SettingsProvider>
            <SessionProvider>
              <AuthProvider>
                <NotificationProvider>
                  <ProjectProvider>
                    <Suspense fallback={null}>{children}</Suspense>
                    <Toast />
                    <DeadlineNotificationToaster />
                  </ProjectProvider>
                </NotificationProvider>
              </AuthProvider>
            </SessionProvider>
          </SettingsProvider>
        </ErrorBoundary>
        <Analytics />
      </body>
    </html>
  )
}
