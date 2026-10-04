import { SiteHeader } from "@/components/site-header"

export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SiteHeader />
      <div className="flex-1">{children}</div>
    </>
  )
}
