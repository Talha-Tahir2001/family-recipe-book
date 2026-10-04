import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { CookMode } from "@/components/cook-mode"
import { Recipe } from "@/models/recipe"
import { connectToMongo } from "@/lib/mongo"

export const dynamic = "force-dynamic"

export async function generateMetadata(
  props: PageProps<"/cook/[id]">
): Promise<Metadata> {
  const { id } = await props.params
  await connectToMongo().catch(() => undefined)
  const recipe = await Recipe.findById(id).select("title").lean()
  return { title: recipe ? `Cooking ${recipe.title}` : "Cook Mode" }
}

export default async function CookPage(props: PageProps<"/cook/[id]">) {
  const { id } = await props.params
  await connectToMongo()

  const recipe = await Recipe.findById(id)
    .select("title servings ingredients steps")
    .lean()

  if (!recipe) {
    notFound()
  }

  return (
    <CookMode
      recipe={{
        _id: recipe._id,
        title: recipe.title,
        servings: recipe.servings ?? null,
        ingredients: recipe.ingredients.map((ingredient) => ({
          qty: ingredient.qty ?? null,
          unit: ingredient.unit ?? null,
          name: ingredient.name,
          note: ingredient.note ?? null,
        })),
        steps: recipe.steps.map((step) => ({
          instruction: step.instruction,
          durationHint: step.durationHint ?? null,
        })),
      }}
    />
  )
}
