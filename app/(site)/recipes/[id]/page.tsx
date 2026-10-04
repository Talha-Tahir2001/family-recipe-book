import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import {
  IconArrowLeft,
  IconChefHat,
  IconClock,
  IconUsers,
} from "@tabler/icons-react"

import { AudioPlayer } from "@/components/audio-player"
import { RecipeEditor } from "@/components/recipe-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { Memo } from "@/models/memo"
import { Recipe } from "@/models/recipe"
import { connectToMongo } from "@/lib/mongo"

export const dynamic = "force-dynamic"

export async function generateMetadata(
  props: PageProps<"/recipes/[id]">
): Promise<Metadata> {
  const { id } = await props.params
  await connectToMongo().catch(() => undefined)
  const recipe = await Recipe.findById(id).select("title summary").lean()
  if (!recipe) return { title: "Recipe not found" }
  return { title: recipe.title, description: recipe.summary }
}

export default async function RecipePage(props: PageProps<"/recipes/[id]">) {
  const { id } = await props.params
  await connectToMongo()

  const recipe = await Recipe.findById(id).lean()
  if (!recipe) {
    notFound()
  }

  const memo = await Memo.findById(recipe.memoId)
    .select("originalName transcript detectedLang")
    .lean()

  const totalTime = (recipe.prepMin ?? 0) + (recipe.cookMin ?? 0)

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        render={<Link href="/" />}
      >
        <IconArrowLeft className="size-4" aria-hidden />
        All recipes
      </Button>

      <header className="mt-4 space-y-3">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {recipe.title}
        </h1>
        {recipe.summary ? (
          <p className="text-lg text-muted-foreground">{recipe.summary}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {totalTime > 0 ? (
            <span className="flex items-center gap-1.5">
              <IconClock className="size-4" aria-hidden />
              {totalTime} min total
            </span>
          ) : null}
          {recipe.servings ? (
            <span className="flex items-center gap-1.5">
              <IconUsers className="size-4" aria-hidden />
              Serves {recipe.servings}
            </span>
          ) : null}
          <span className="flex items-center gap-1.5">
            <IconChefHat className="size-4" aria-hidden />
            {recipe.steps.length} steps
          </span>
        </div>
        {recipe.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {recipe.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            nativeButton={false}
            render={<Link href={`/cook/${recipe._id}`} />}
          >
            Start Cook Mode
          </Button>
          <RecipeEditor recipe={recipe} />
          {recipe.extractedBy ? (
            <span className="font-mono text-xs text-muted-foreground">
              extracted with {recipe.extractedBy}
            </span>
          ) : null}
        </div>
      </header>

      {recipe.story ? (
        <Card className="mt-8 bg-muted/40">
          <CardHeader>
            <CardTitle className="font-heading text-lg">
              Why this dish exists
            </CardTitle>
            <CardDescription>
              Kept as close to the original telling as possible
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="leading-relaxed whitespace-pre-wrap">
              {recipe.story}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="font-heading text-2xl font-semibold">Ingredients</h2>
        {recipe.ingredients.length > 0 ? (
          <ul className="space-y-2">
            {recipe.ingredients.map((ingredient, index) => (
              <li key={index} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium tabular-nums">
                  {[ingredient.qty, ingredient.unit].filter(Boolean).join(" ")}
                </span>
                <span>{ingredient.name}</span>
                {ingredient.note ? (
                  <span className="text-sm text-muted-foreground italic">
                    — {ingredient.note}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No ingredients were extracted for this one.
          </p>
        )}
      </section>

      <Separator className="my-8" />

      <section className="space-y-5">
        <h2 className="font-heading text-2xl font-semibold">Steps</h2>
        <ol className="space-y-4">
          {recipe.steps.map((step, index) => (
            <li key={index} className="flex gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                {index + 1}
              </span>
              <div className="pt-1">
                <p className="leading-relaxed">{step.instruction}</p>
                {step.durationHint ? (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <IconClock className="size-3.5" aria-hidden />
                    {step.durationHint}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {recipe.tips.length > 0 ? (
        <>
          <Separator className="my-8" />
          <section className="space-y-3">
            <h2 className="font-heading text-2xl font-semibold">
              Tips from the kitchen
            </h2>
            <ul className="space-y-2 text-muted-foreground">
              {recipe.tips.map((tip, index) => (
                <li key={index} className="flex gap-2">
                  <span aria-hidden>•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="font-heading text-2xl font-semibold">
          The voice behind this recipe
        </h2>
        {memo ? (
          <>
            <AudioPlayer
              src={`/api/memos/${recipe.memoId}/audio`}
              label={memo.originalName}
            />
            {memo.transcript ? (
              <Collapsible>
                <CollapsibleTrigger className="text-sm font-medium">
                  Read the raw transcript
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <p className="mt-3 rounded-2xl bg-muted/40 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {memo.transcript}
                  </p>
                  {memo.detectedLang ? (
                    <p className="mt-2 font-mono text-xs text-muted-foreground">
                      detected language: {memo.detectedLang}
                    </p>
                  ) : null}
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            The original memo for this recipe is no longer available.
          </p>
        )}
      </section>
    </main>
  )
}
