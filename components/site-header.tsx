import Link from "next/link"
import { IconBook2, IconMicrophone } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 font-heading text-lg font-semibold"
        >
          <IconBook2 className="size-5 text-primary" aria-hidden />
          Family Recipe Book
        </Link>
        <Button
          size="sm"
          nativeButton={false}
          render={<Link href="/upload" />}
          className="min-h-11"
        >
          <IconMicrophone className="size-4" aria-hidden />
          Add voice memo
        </Button>
      </div>
    </header>
  )
}
