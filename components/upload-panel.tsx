"use client"

import * as React from "react"
import { toast } from "sonner"

import { MemoDropzone, validateAudioFile } from "@/components/memo-dropzone"
import { PipelineStatus } from "@/components/pipeline-status"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type UploadResponse = { memoId: string } | { error: string }

export function UploadPanel() {
  const [file, setFile] = React.useState<File | null>(null)
  const [keyterms, setKeyterms] = React.useState("")
  const [memoId, setMemoId] = React.useState<string | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [fileError, setFileError] = React.useState<string | null>(null)

  function handleFileChange(next: File | null) {
    setFile(next)
    setFileError(next ? validateAudioFile(next) : null)
  }

  async function submit() {
    if (!file || fileError) return
    setIsUploading(true)

    const form = new FormData()
    form.append("file", file)
    if (keyterms.trim()) form.append("keyterms", keyterms.trim())

    try {
      const response = await fetch("/api/memos", { method: "POST", body: form })
      const data = (await response.json()) as UploadResponse

      if (!response.ok || "error" in data) {
        const message = "error" in data ? data.error : "Upload failed"
        setFileError(message)
        toast.error(message)
        setIsUploading(false)
        return
      }

      toast.success("Memo received — transcribing now")
      setMemoId(data.memoId)
      setIsUploading(false)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Upload failed unexpectedly"
      setFileError(message)
      toast.error(message)
      setIsUploading(false)
    }
  }

  function startAnother() {
    setMemoId(null)
    setFile(null)
    setKeyterms("")
    setFileError(null)
  }

  if (memoId) {
    return (
      <div className="space-y-6">
        <PipelineStatus key={memoId} memoId={memoId} />
        <Button variant="ghost" onClick={startAnother}>
          Add another memo
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <MemoDropzone
        file={file}
        onFileChange={handleFileChange}
        disabled={isUploading}
      />

      {fileError ? (
        <Alert variant="destructive">
          <AlertTitle>That file will not work</AlertTitle>
          <AlertDescription>{fileError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="keyterms">
          Dish name hints{" "}
          <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="keyterms"
          value={keyterms}
          onChange={(event) => setKeyterms(event.target.value)}
          placeholder="e.g. paneer bhurji, upma"
          disabled={isUploading}
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated. Helps speech-to-text spell the dish the way your
          family says it.
        </p>
      </div>

      <Button
        size="lg"
        onClick={submit}
        disabled={!file || Boolean(fileError) || isUploading}
        className="w-full sm:w-auto"
      >
        {isUploading ? "Uploading…" : "Turn this into a recipe"}
      </Button>
    </div>
  )
}
