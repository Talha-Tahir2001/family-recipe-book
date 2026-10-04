"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { ACCEPTED_AUDIO_ATTRIBUTE, looksLikeAudioFile } from "@/lib/audio"

export type DropzoneProps = {
  file: File | null
  onFileChange: (file: File | null) => void
  disabled?: boolean
}

const MAX_BYTES = 50 * 1024 * 1024

export function validateAudioFile(file: File): string | null {
  if (!looksLikeAudioFile(file)) {
    return `“${file.name}” is not an audio file. Accepted formats: m4a, mp3, wav, ogg, webm, aac.`
  }
  if (file.size > MAX_BYTES) {
    return `“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 50 MB.`
  }
  return null
}

export function MemoDropzone({ file, onFileChange, disabled }: DropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)

  function accept(candidate: File | undefined) {
    if (candidate) onFileChange(candidate)
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragging(false)
        if (disabled) return
        accept(event.dataTransfer.files?.[0])
      }}
      className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors sm:p-10 ${
        isDragging ? "border-primary bg-primary/5" : "border-border bg-muted/30"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_AUDIO_ATTRIBUTE}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => accept(event.target.files?.[0])}
      />
      <p className="font-heading text-lg font-semibold">
        {file ? file.name : "Drop a voice memo here"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {file
          ? `${(file.size / 1024 / 1024).toFixed(1)} MB · ${file.type || "unknown type"}`
          : "WhatsApp voice notes work great. m4a, mp3, wav, ogg, webm."}
      </p>
      <div className="mt-4 flex items-center justify-center gap-2">
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          {file ? "Choose a different file" : "Choose a file"}
        </Button>
        {file ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => onFileChange(null)}
            disabled={disabled}
          >
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  )
}
