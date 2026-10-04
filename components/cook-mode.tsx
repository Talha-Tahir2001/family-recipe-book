"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconArrowLeft,
  IconPlayerPause,
  IconPlayerPlay,
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { Ingredient, Step } from "@/lib/schema"

export type CookModeRecipe = {
  _id: string
  title: string
  servings: number | null
  ingredients: Ingredient[]
  steps: Step[]
}

export function CookMode({ recipe }: { recipe: CookModeRecipe }) {
  const [index, setIndex] = React.useState(0)
  const [playingStep, setPlayingStep] = React.useState<number | null>(null)
  const [pendingStep, setPendingStep] = React.useState<number | null>(null)
  const [autoNarrate, setAutoNarrate] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const audioRef = React.useRef<HTMLAudioElement>(null)
  const requestedStepRef = React.useRef<number | null>(null)

  const steps = recipe.steps
  const step = steps[index]
  const isLast = index === steps.length - 1
  const percent = steps.length > 0 ? ((index + 1) / steps.length) * 100 : 0
  const isNarrating = playingStep === index
  const isPreparing = pendingStep === index && playingStep !== index

  // Changing step only touches the audio element and kicks off narration;
  // every state update happens inside the async continuation.
  React.useEffect(() => {
    audioRef.current?.pause()
    if (!autoNarrate || !step) return
    void narrateStep(index)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, autoNarrate])

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        event.preventDefault()
        setIndex((current) => Math.min(current + 1, steps.length - 1))
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        setIndex((current) => Math.max(current - 1, 0))
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [steps.length])

  async function narrateStep(stepIndex: number) {
    if (requestedStepRef.current === stepIndex) return
    requestedStepRef.current = stepIndex

    try {
      const response = await fetch(`/api/recipes/${recipe._id}/narrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: stepIndex }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string
        }
        throw new Error(data.error ?? "Could not build the narration")
      }

      const blob = await response.blob()
      const audio = audioRef.current
      if (!audio || stepIndex !== index) return

      if (audio.src.startsWith("blob:")) {
        URL.revokeObjectURL(audio.src)
      }
      audio.src = URL.createObjectURL(blob)
      await audio.play()
    } catch (narrateError) {
      requestedStepRef.current = null
      setError(
        narrateError instanceof Error
          ? narrateError.message
          : "Could not build the narration"
      )
    } finally {
      setPendingStep((current) => (current === stepIndex ? null : current))
    }
  }

  function togglePlayback() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      if (!audio.src) {
        setPendingStep(index)
        setError(null)
        void narrateStep(index)
        return
      }
      requestedStepRef.current = index
      void audio.play()
    } else {
      audio.pause()
    }
  }

  function setAutoNarration(next: boolean) {
    setAutoNarrate(next)
    if (!next) audioRef.current?.pause()
  }

  function goNext() {
    setError(null)
    setPlayingStep(null)
    setIndex((current) => Math.min(current + 1, steps.length - 1))
  }

  function goPrevious() {
    setError(null)
    setPlayingStep(null)
    setIndex((current) => Math.max(current - 1, 0))
  }

  if (!step) {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-heading text-2xl font-semibold">
          This recipe has no steps
        </h1>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/" />}
        >
          Back to the book
        </Button>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 p-4 pb-8 sm:p-8">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href={`/recipes/${recipe._id}`} />}
          >
            <IconArrowLeft className="size-4" aria-hidden />
            Recipe
          </Button>
          <h1 className="mt-1 truncate font-heading text-xl font-semibold">
            {recipe.title}
          </h1>
        </div>
        <Button
          variant={autoNarrate ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setAutoNarration(!autoNarrate)}
          aria-pressed={autoNarrate}
          className="min-h-11 shrink-0"
        >
          {autoNarrate ? (
            <IconVolume className="size-4" aria-hidden />
          ) : (
            <IconVolumeOff className="size-4" aria-hidden />
          )}
          Auto-read {autoNarrate ? "on" : "off"}
        </Button>
      </header>

      <Progress value={percent} aria-label="Cooking progress" />

      <section className="flex flex-1 flex-col justify-center gap-6 py-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1.5 text-base">
            Step {index + 1} of {steps.length}
          </Badge>
          {step.durationHint ? (
            <Badge variant="outline" className="px-3 py-1.5 text-base">
              {step.durationHint}
            </Badge>
          ) : null}
        </div>

        <p className="font-heading text-3xl leading-snug font-medium sm:text-4xl lg:text-5xl">
          {step.instruction}
        </p>

        {error ? <p className="text-base text-destructive">{error}</p> : null}
      </section>

      <section className="space-y-4">
        <div className="rounded-2xl bg-muted/40 p-4">
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Ingredients on hand
          </h2>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {recipe.ingredients.map((ingredient, ingredientIndex) => (
              <li key={ingredientIndex} className="text-base">
                <span className="font-medium tabular-nums">
                  {[ingredient.qty, ingredient.unit].filter(Boolean).join(" ")}
                </span>{" "}
                {ingredient.name}
              </li>
            ))}
          </ul>
        </div>

        <audio
          ref={audioRef}
          onPlay={() => setPlayingStep(index)}
          onPause={() => setPlayingStep(null)}
          onEnded={() => setPlayingStep(null)}
          className="hidden"
        />

        <div className="flex items-center justify-between gap-3">
          <Button
            size="icon-lg"
            variant="secondary"
            onClick={goPrevious}
            disabled={index === 0}
            aria-label="Previous step"
            className="size-14"
          >
            ←
          </Button>

          <Button
            size="lg"
            onClick={togglePlayback}
            disabled={isPreparing}
            aria-label={
              isNarrating ? "Pause narration" : "Read this step aloud"
            }
            className="h-14 min-w-44 px-6 text-lg"
          >
            {isPreparing ? (
              "Preparing…"
            ) : isNarrating ? (
              <IconPlayerPause className="size-5" aria-hidden />
            ) : (
              <IconPlayerPlay className="size-5" aria-hidden />
            )}
            {isNarrating ? "Pause" : "Read aloud"}
          </Button>

          <Button
            size="lg"
            onClick={goNext}
            disabled={isLast}
            aria-label="Next step"
            className="h-14 px-6 text-lg"
          >
            {isLast ? "Done" : "Next →"}
          </Button>
        </div>

        {isLast ? (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/recipes/${recipe._id}`} />}
          >
            Finish and view the recipe
          </Button>
        ) : null}
      </section>
    </main>
  )
}
