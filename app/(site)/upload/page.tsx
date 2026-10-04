import type { Metadata } from "next"

import { UploadPanel } from "@/components/upload-panel"

export const metadata: Metadata = {
  title: "Add a voice memo",
  description:
    "Upload a voice memo of someone describing a recipe and get a structured recipe back.",
}

export default function UploadPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
      <header className="mb-8 space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Add a voice memo
        </h1>
        <p className="text-muted-foreground">
          Drop a WhatsApp voice note or phone recording. We transcribe it, pull
          out the recipe, and keep the story behind it exactly as it was told.
        </p>
      </header>
      <UploadPanel />
    </main>
  )
}
