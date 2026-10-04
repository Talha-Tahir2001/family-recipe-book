"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"
import type { MemoStatus } from "@/lib/schema"

const STAGES = [
  { key: "uploaded", label: "Uploaded" },
  { key: "transcribing", label: "Transcribing" },
  { key: "extracting", label: "Extracting" },
  { key: "ready", label: "Ready" },
] as const satisfies readonly { key: MemoStatus; label: string }[]

const STAGE_INDEX: Record<MemoStatus, number> = {
  uploaded: 0,
  transcribing: 1,
  extracting: 2,
  ready: 3,
  error: 3,
}

const POLL_INTERVAL_MS = 1500

type MemoStatusResponse = {
  status: MemoStatus
  recipeId: string | null
  error: string | null
  transcript: string | null
}

export function PipelineStatus({ memoId }: { memoId: string }) {
  const router = useRouter()
  const [state, setState] = React.useState<MemoStatusResponse | null>(null)
  const [isRetrying, setIsRetrying] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    async function poll() {
      try {
        const response = await fetch(`/api/memos/${memoId}`, {
          cache: "no-store",
        })
        const data = (await response.json()) as MemoStatusResponse
        if (cancelled) return
        setState(data)

        if (data.status === "ready") {
          router.refresh()
          return
        }
        if (data.status === "error") return
      } catch {
        if (!cancelled) setState(null)
      }
      if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL_MS)
    }

    poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [memoId, router])

  async function retry() {
    setIsRetrying(true)
    try {
      await fetch(`/api/memos/${memoId}`, { method: "POST" })
      setState((current) =>
        current ? { ...current, status: "uploaded", error: null } : current
      )
      setIsRetrying(false)
      window.location.reload()
    } catch {
      setIsRetrying(false)
    }
  }

  const status: MemoStatus = state?.status ?? "uploaded"
  const stageIndex = STAGE_INDEX[status]
  const percent = status === "error" ? 100 : Math.round((stageIndex / 3) * 100)

  return (
    <div className="space-y-4">
      <Progress
        value={percent}
        aria-label="Recipe processing progress"
        className="w-full"
      />
      <ol className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {STAGES.map((stage, index) => {
          const reached = index <= stageIndex
          const current = index === stageIndex && status !== "error"
          return (
            <li
              key={stage.key}
              className={`flex items-center gap-2 ${
                reached ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <span
                className={`flex size-6 items-center justify-center rounded-full text-xs font-medium ${
                  reached
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {index + 1}
              </span>
              <span className={current ? "font-medium" : undefined}>
                {stage.label}
                {current ? "…" : ""}
              </span>
            </li>
          )
        })}
      </ol>

      {status === "ready" && state?.recipeId ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            nativeButton={false}
            render={<Link href={`/recipes/${state.recipeId}`} />}
          >
            Open the recipe
          </Button>
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/" />}
          >
            Back to the book
          </Button>
        </div>
      ) : null}

      {status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>That memo could not be turned into a recipe</AlertTitle>
          <AlertDescription className="space-y-3">
            <p className="font-mono text-xs break-words">
              {state?.error ?? "Unknown error"}
            </p>
            <Button variant="outline" onClick={retry} disabled={isRetrying}>
              {isRetrying ? "Retrying…" : "Try again"}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {state?.transcript ? (
        <Collapsible>
          <CollapsibleTrigger className="text-sm font-medium">
            Show the transcript so far
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="mt-2 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {state.transcript}
            </p>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  )
}
