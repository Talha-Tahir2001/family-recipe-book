import type { Metadata } from "next"

import { Gallery } from "@/components/gallery"

export const metadata: Metadata = {
  title: "Family Recipe Book",
  description:
    "Voice memos in, structured family recipes out — with the story kept intact.",
}

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <header className="mb-8 space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          The family recipe book
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Every dish here started as someone talking — often for minutes, often
          off-topic. The words stay exactly as they were said.
        </p>
      </header>
      <Gallery />
    </main>
  )
}
