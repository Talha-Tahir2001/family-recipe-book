"use client"

import * as React from "react"
import Link from "next/link"
import { IconSearch, IconSparkles } from "@tabler/icons-react"

import { RecipeCard, type RecipeCardData } from "@/components/recipe-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

type SearchResponse = {
  recipes: RecipeCardData[]
  tags: string[]
  mode: "hybrid" | "keyword" | "all"
  degradedReason: string | null
  expanded?: boolean
}

const DEBOUNCE_MS = 350

export function Gallery() {
  const [query, setQuery] = React.useState("")
  const [selectedTags, setSelectedTags] = React.useState<string[]>([])
  const [state, setState] = React.useState<SearchResponse | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const controller = new AbortController()

    async function load(signal: AbortSignal) {
      setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (query.trim()) params.set("q", query.trim())
        for (const tag of selectedTags) params.append("tag", tag)
        params.set("limit", "24")

        const response = await fetch(`/api/recipes?${params}`, {
          signal,
          cache: "no-store",
        })
        const data = (await response.json()) as SearchResponse & {
          error?: string
        }

        if (signal.aborted) return

        if (!response.ok) {
          setError(data.error ?? "Could not load the recipe book")
          return
        }

        setState(data)
      } catch (fetchError) {
        if ((fetchError as Error).name === "AbortError") return
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Could not reach the recipe book"
        )
      } finally {
        if (!signal.aborted) setIsLoading(false)
      }
    }

    const timer = setTimeout(() => void load(controller.signal), DEBOUNCE_MS)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query, selectedTags])

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((value) => value !== tag)
        : [...current, tag]
    )
  }

  function clearAll() {
    setQuery("")
    setSelectedTags([])
  }

  const recipes = state?.recipes ?? []
  const hasFilters = query.trim().length > 0 || selectedTags.length > 0

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="relative">
          <IconSearch
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search recipes — try “paneer” or “something warm for a rainy evening”"
            aria-label="Search recipes"
            className="h-12 pl-11 text-base"
          />
        </div>

        {state?.tags.length ? (
          <div className="flex flex-wrap items-center gap-2">
            {state.tags.map((tag) => {
              const active = selectedTags.includes(tag)
              return (
                <Badge
                  key={tag}
                  role="button"
                  tabIndex={0}
                  aria-pressed={active}
                  onClick={() => toggleTag(tag)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      toggleTag(tag)
                    }
                  }}
                  variant={active ? "default" : "secondary"}
                  className="cursor-pointer px-3 py-1.5"
                >
                  {tag}
                </Badge>
              )
            })}
            {selectedTags.length > 0 ? (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setSelectedTags([])}
              >
                Clear tags
              </Button>
            ) : null}
          </div>
        ) : null}

        {state?.mode === "keyword" && state.degradedReason ? (
          <Alert>
            <AlertTitle>Showing keyword matches only</AlertTitle>
            <AlertDescription className="font-mono text-xs wrap-break-word">
              Semantic search is unavailable right now: {state.degradedReason}
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>The recipe book did not load</AlertTitle>
          <AlertDescription>
            <p>{error}</p>
            <p className="mt-2 text-xs">
              Check that MONGODB_URI is set and reachable, then try again.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : recipes.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe._id} recipe={recipe} />
            ))}
          </div>
          {state?.mode === "hybrid" ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <IconSparkles className="size-3.5" aria-hidden />
              Ranked with Atlas Vector Search alongside keyword matches
            </p>
          ) : null}
        </>
      ) : hasFilters ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <h2 className="font-heading text-lg font-semibold">
            Nothing matched that
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Try a single ingredient, or clear the filters and browse the whole
            book.
          </p>
          <Button variant="outline" className="mt-4" onClick={clearAll}>
            Clear search and filters
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <h2 className="font-heading text-lg font-semibold">
            The book is empty — for now
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Record someone describing a dish the old way. Upload the voice note
            and the recipe writes itself.
          </p>
          <Button
            className="mt-4"
            nativeButton={false}
            render={<Link href="/upload" />}
          >
            Add a voice memo
          </Button>
        </div>
      )}
    </div>
  )
}
