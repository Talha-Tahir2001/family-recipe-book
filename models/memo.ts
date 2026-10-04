import mongoose from "mongoose"

import { MEMO_STATUSES } from "@/lib/schema"

const memoSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    storedPath: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    byteSize: { type: Number },
    durationSec: { type: Number },
    status: {
      type: String,
      enum: MEMO_STATUSES,
      default: "uploaded",
      required: true,
    },
    transcript: { type: String },
    detectedLang: { type: String },
    keyterms: { type: [String], default: [] },
    recipeId: { type: String },
    error: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: true }, versionKey: false }
)

memoSchema.index({ status: 1, createdAt: -1 })

export type MemoShape = mongoose.InferSchemaType<typeof memoSchema>

function compileMemoModel() {
  return mongoose.model("Memo", memoSchema)
}

export type MemoModel = ReturnType<typeof compileMemoModel>

export const Memo: MemoModel =
  (mongoose.models.Memo as MemoModel | undefined) ?? compileMemoModel()
