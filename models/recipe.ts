import mongoose from "mongoose"

import type { RecipeShape } from "@/lib/schema"

const ingredientSchema = new mongoose.Schema(
  {
    qty: { type: String, default: null },
    unit: { type: String, default: null },
    name: { type: String, required: true },
    note: { type: String, default: null },
  },
  { _id: false }
)

const stepSchema = new mongoose.Schema(
  {
    instruction: { type: String, required: true },
    durationHint: { type: String, default: null },
  },
  { _id: false }
)

const recipeSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    memoId: { type: String, required: true },
    title: { type: String, required: true },
    summary: { type: String, default: "" },
    story: { type: String, default: null },
    servings: { type: Number, default: null },
    prepMin: { type: Number, default: null },
    cookMin: { type: Number, default: null },
    tags: { type: [String], default: [] },
    ingredients: { type: [ingredientSchema], default: [] },
    steps: { type: [stepSchema], default: [] },
    tips: { type: [String], default: [] },
    embedding: { type: [Number], default: undefined },
    embeddingModel: { type: String, default: null },
    extractedBy: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: true }, versionKey: false }
)

recipeSchema.index({ memoId: 1 })
recipeSchema.index({ tags: 1 })

export type RecipeShapeDoc = mongoose.InferSchemaType<typeof recipeSchema>

export type RecipeInput = RecipeShape & {
  _id: string
  memoId: string
  extractedBy?: string
}

function compileRecipeModel() {
  return mongoose.model("Recipe", recipeSchema)
}

export type RecipeModel = ReturnType<typeof compileRecipeModel>

export const Recipe: RecipeModel =
  (mongoose.models.Recipe as RecipeModel | undefined) ?? compileRecipeModel()
