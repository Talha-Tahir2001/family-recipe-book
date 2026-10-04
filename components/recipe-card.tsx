import Link from "next/link"
import { IconClock, IconUsers } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export type RecipeCardData = {
  _id: string
  title: string
  summary: string
  story: string | null
  servings: number | null
  prepMin: number | null
  cookMin: number | null
  tags: string[]
  ingredientNames: string[]
  matchReason?: "keyword" | "semantic" | "both"
}

export function RecipeCard({ recipe }: { recipe: RecipeCardData }) {
  const totalTime = (recipe.prepMin ?? 0) + (recipe.cookMin ?? 0)

  return (
    // `relative` is required: shadcn's Card is not positioned, so the stretched
    // link overlay below would otherwise resolve against the page and swallow
    // clicks on everything beneath the gallery.
    <Card className="relative h-full transition-shadow hover:shadow-md">
      <CardHeader>
        <CardTitle className="font-heading text-xl">
          <Link
            href={`/recipes/${recipe._id}`}
            className="after:absolute after:inset-0"
          >
            {recipe.title}
          </Link>
        </CardTitle>
        {recipe.summary ? (
          <CardDescription>{recipe.summary}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {recipe.story ? (
          <p className="border-l-2 pl-3 text-sm text-muted-foreground italic">
            “{trimTo(recipe.story, 140)}”
          </p>
        ) : null}
        {recipe.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {recipe.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="relative z-10 gap-4 text-xs text-muted-foreground">
        {totalTime > 0 ? (
          <span className="flex items-center gap-1">
            <IconClock className="size-4" aria-hidden />
            {totalTime} min
          </span>
        ) : null}
        {recipe.servings ? (
          <span className="flex items-center gap-1">
            <IconUsers className="size-4" aria-hidden />
            Serves {recipe.servings}
          </span>
        ) : null}
        {recipe.ingredientNames.length > 0 ? (
          <span className="truncate">
            {trimTo(recipe.ingredientNames.slice(0, 3).join(", "), 46)}
          </span>
        ) : null}
      </CardFooter>
    </Card>
  )
}

function trimTo(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`
}
