import { Geist_Mono, IBM_Plex_Sans, Montserrat } from "next/font/google"
import type { Metadata, Viewport } from "next"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const montserratHeading = Montserrat({
  subsets: ["latin"],
  variable: "--font-heading",
})

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: {
    default: "Family Recipe Book",
    template: "%s · Family Recipe Book",
  },
  description:
    "Voice memos in, structured family recipes out — with the story kept intact.",
  applicationName: "Family Recipe Book",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#17181c" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={cn(
        "font-sans antialiased",
        fontMono.variable,
        ibmPlexSans.variable,
        montserratHeading.variable
      )}
    >
      <body className="min-h-svh">
        <ThemeProvider>
          <TooltipProvider>
            <div className="flex min-h-svh flex-col">{children}</div>
            <Toaster position="bottom-center" richColors />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
