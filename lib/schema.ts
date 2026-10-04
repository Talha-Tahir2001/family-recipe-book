import { z } from "zod"

export const MEMO_STATUSES = [
  "uploaded",
  "transcribing",
  "extracting",
  "ready",
  "error",
] as const

export const memoStatusSchema = z.enum(MEMO_STATUSES)
export type MemoStatus = z.infer<typeof memoStatusSchema>

export const ingredientSchema = z.object({
  qty: z.string().nullish(),
  unit: z.string().nullish(),
  name: z.string().min(1),
  note: z.string().nullish(),
})

export const stepSchema = z.object({
  instruction: z.string().min(1),
  durationHint: z.string().nullish(),
})

/**
 * Fields without defaults. `recipeShapeSchema` adds defaults for extraction;
 * `recipePatchSchema` must stay default-free so a partial PATCH never wipes
 * arrays the client did not send (Zod 4 keeps defaults through `.partial()`).
 */
const recipeFields = {
  title: z.string().min(1),
  summary: z.string(),
  story: z.string().nullish(),
  servings: z.number().int().positive().nullish(),
  prepMin: z.number().int().nonnegative().nullish(),
  cookMin: z.number().int().nonnegative().nullish(),
  tags: z.array(z.string()),
  ingredients: z.array(ingredientSchema),
  steps: z.array(stepSchema),
  tips: z.array(z.string()),
}

const recipeBaseSchema = z.object(recipeFields)

export const recipeShapeSchema = recipeBaseSchema.extend({
  summary: recipeFields.summary.default(""),
  tags: recipeFields.tags.default([]),
  ingredients: recipeFields.ingredients.default([]),
  steps: recipeFields.steps.default([]),
  tips: recipeFields.tips.default([]),
})

export const extractedRecipeSchema = recipeShapeSchema.transform((recipe) =>
  normalizeRecipe(recipe)
)

export type Ingredient = z.infer<typeof ingredientSchema>
export type Step = z.infer<typeof stepSchema>
export type RecipeShape = z.infer<typeof recipeShapeSchema>

export const uploadFieldsSchema = z.object({
  keyterms: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? "")
        .split(",")
        .map((term) => term.trim())
        .filter(Boolean)
    ),
})

export const recipePatchSchema = recipeBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  })

export const searchQuerySchema = z.object({
  q: z.string().trim().default(""),
  tags: z.array(z.string()).default([]),
  limit: z.coerce.number().int().positive().max(50).default(24),
})

export const narrateBodySchema = z.object({
  step: z.number().int().nonnegative(),
  text: z.string().min(1).optional(),
})

function optionalString(value: string | null | undefined) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function optionalNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  const rounded = Math.round(value)
  return rounded > 0 ? rounded : null
}

function normalizeRecipe(recipe: RecipeShape): RecipeShape {
  return {
    title: recipe.title.trim(),
    summary: recipe.summary?.trim() ?? "",
    story: optionalString(recipe.story),
    servings: optionalNumber(recipe.servings),
    prepMin: optionalNumber(recipe.prepMin),
    cookMin: optionalNumber(recipe.cookMin),
    tags: dedupe(recipe.tags.map((tag) => tag.trim()).filter(Boolean)),
    ingredients: recipe.ingredients.map((ingredient) => ({
      qty: optionalString(ingredient.qty),
      unit: optionalString(ingredient.unit),
      name: ingredient.name.trim(),
      note: optionalString(ingredient.note),
    })),
    steps: recipe.steps.map((step) => ({
      instruction: step.instruction.trim(),
      durationHint: optionalString(step.durationHint),
    })),
    tips: dedupe(recipe.tips.map((tip) => tip.trim()).filter(Boolean)),
  }
}

function dedupe(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result
}

export { dedupe, normalizeRecipe }
