import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { Toast } from "@/components/ui/toast"
import { ProjectProvider } from "@/contexts/project-context"
import { SettingsProvider } from "@/contexts/settings-context"
import { AuthProvider } from "@/hooks/useAuth"
import { SessionProvider } from "@/components/session-provider"
import { DeadlineNotificationToaster } from "@/components/deadline-notification-toaster"
import "./globals.css"
import "@/styles/themes.css"

export const metadata = {
  title: "G3T5 Project Timeline",
  description: "Project management timeline interface",
  generator: "v0.app",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <SettingsProvider>
          <SessionProvider>
            <AuthProvider>
              <ProjectProvider>
                <Suspense fallback={null}>{children}</Suspense>
                <Toast />
                <DeadlineNotificationToaster />
              </ProjectProvider>
            </AuthProvider>
          </SessionProvider>
        </SettingsProvider>
        <Analytics />
      </body>
    </html>
  )
}
