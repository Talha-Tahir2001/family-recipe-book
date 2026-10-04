import { NextResponse } from "next/server"
import { ZodError } from "zod"

export function jsonError(message: string, status = 400, extra?: unknown) {
  return NextResponse.json(
    { error: message, ...(extra ? { detail: extra } : {}) },
    { status }
  )
}

export function jsonFromZodError(error: ZodError) {
  return jsonError("Validation failed", 422, error.issues)
}

export function describeError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
