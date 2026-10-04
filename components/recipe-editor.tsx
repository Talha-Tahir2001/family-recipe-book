"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { IconPencil, IconX } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Ingredient, RecipeShape, Step } from "@/lib/schema"

type EditableRecipe = RecipeShape & { _id: string }

export function RecipeEditor({ recipe }: { recipe: EditableRecipe }) {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <IconPencil className="size-4" aria-hidden />
            Fix something
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fix the extraction</DialogTitle>
          <DialogDescription>
            Anything Gemma got wrong or left vague can be corrected here. Saving
            re-embeds the recipe so search stays accurate.
          </DialogDescription>
        </DialogHeader>
        <RecipeForm recipe={recipe} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function RecipeForm({
  recipe,
  onSaved,
}: {
  recipe: EditableRecipe
  onSaved: () => void
}) {
  const router = useRouter()
  const [isSaving, setIsSaving] = React.useState(false)

  const [title, setTitle] = React.useState(recipe.title)
  const [summary, setSummary] = React.useState(recipe.summary ?? "")
  const [story, setStory] = React.useState(recipe.story ?? "")
  const [tags, setTags] = React.useState(recipe.tags.join(", "))
  const [servings, setServings] = React.useState(
    recipe.servings ? String(recipe.servings) : ""
  )
  const [prepMin, setPrepMin] = React.useState(
    recipe.prepMin ? String(recipe.prepMin) : ""
  )
  const [cookMin, setCookMin] = React.useState(
    recipe.cookMin ? String(recipe.cookMin) : ""
  )
  const [ingredients, setIngredients] = React.useState<Ingredient[]>(
    recipe.ingredients.map((ingredient) => ({ ...ingredient }))
  )
  const [steps, setSteps] = React.useState<Step[]>(
    recipe.steps.map((step) => ({ ...step }))
  )

  async function save() {
    setIsSaving(true)
    const payload = {
      title: title.trim(),
      summary: summary.trim(),
      story: story.trim() || null,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      servings: toNumber(servings),
      prepMin: toNumber(prepMin),
      cookMin: toNumber(cookMin),
      ingredients,
      steps,
    }

    try {
      const response = await fetch(`/api/recipes/${recipe._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error ?? "Could not save the changes")
      }
      toast.success("Recipe updated")
      onSaved()
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the changes"
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" id="title">
          <Input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Field label="Tags" id="tags" hint="comma separated">
          <Input
            id="tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Summary" id="summary">
            <Textarea
              id="summary"
              rows={2}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="The story" id="story">
            <Textarea
              id="story"
              rows={4}
              value={story}
              onChange={(event) => setStory(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Servings" id="servings">
          <Input
            id="servings"
            inputMode="numeric"
            value={servings}
            onChange={(event) => setServings(event.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prep (min)" id="prepMin">
            <Input
              id="prepMin"
              inputMode="numeric"
              value={prepMin}
              onChange={(event) => setPrepMin(event.target.value)}
            />
          </Field>
          <Field label="Cook (min)" id="cookMin">
            <Input
              id="cookMin"
              inputMode="numeric"
              value={cookMin}
              onChange={(event) => setCookMin(event.target.value)}
            />
          </Field>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="font-heading font-semibold">Ingredients</h3>
        {ingredients.map((ingredient, index) => (
          <div key={index} className="grid grid-cols-12 gap-2">
            <Input
              aria-label={`Ingredient ${index + 1} quantity`}
              placeholder="qty"
              className="col-span-3"
              value={ingredient.qty ?? ""}
              onChange={(event) =>
                updateIngredient(ingredients, setIngredients, index, {
                  qty: event.target.value,
                })
              }
            />
            <Input
              aria-label={`Ingredient ${index + 1} unit`}
              placeholder="unit"
              className="col-span-3"
              value={ingredient.unit ?? ""}
              onChange={(event) =>
                updateIngredient(ingredients, setIngredients, index, {
                  unit: event.target.value,
                })
              }
            />
            <Input
              aria-label={`Ingredient ${index + 1} name`}
              placeholder="name"
              className="col-span-6"
              value={ingredient.name}
              onChange={(event) =>
                updateIngredient(ingredients, setIngredients, index, {
                  name: event.target.value,
                })
              }
            />
            <Input
              aria-label={`Ingredient ${index + 1} note`}
              placeholder="note — keep the original wording"
              className="col-span-11"
              value={ingredient.note ?? ""}
              onChange={(event) =>
                updateIngredient(ingredients, setIngredients, index, {
                  note: event.target.value,
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ingredient ${index + 1}`}
              onClick={() =>
                setIngredients(ingredients.filter((_, i) => i !== index))
              }
            >
              <IconX className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setIngredients([
              ...ingredients,
              { qty: "", unit: "", name: "", note: "" },
            ])
          }
        >
          Add ingredient
        </Button>
      </section>

      <section className="space-y-3">
        <h3 className="font-heading font-semibold">Steps</h3>
        {steps.map((step, index) => (
          <div key={index} className="flex items-start gap-2">
            <span className="mt-2.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
              {index + 1}
            </span>
            <Textarea
              aria-label={`Step ${index + 1}`}
              rows={2}
              value={step.instruction}
              onChange={(event) =>
                setSteps(
                  steps.map((current, i) =>
                    i === index
                      ? { ...current, instruction: event.target.value }
                      : current
                  )
                )
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove step ${index + 1}`}
              onClick={() => setSteps(steps.filter((_, i) => i !== index))}
            >
              <IconX className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setSteps([...steps, { instruction: "", durationHint: "" }])
          }
        >
          Add step
        </Button>
      </section>

      <DialogFooter>
        <DialogClose render={<Button variant="ghost" disabled={isSaving} />}>
          Cancel
        </DialogClose>
        <Button onClick={save} disabled={isSaving || !title.trim()}>
          {isSaving ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </div>
  )
}

function Field({
  label,
  id,
  hint,
  children,
}: {
  label: string
  id: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {hint ? (
          <span className="ml-1 font-normal text-muted-foreground">
            ({hint})
          </span>
        ) : null}
      </Label>
      {children}
    </div>
  )
}

function updateIngredient(
  current: Ingredient[],
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>,
  index: number,
  patch: Partial<Ingredient>
) {
  setIngredients(
    current.map((ingredient, i) =>
      i === index ? { ...ingredient, ...patch } : ingredient
    )
  )
}

function toNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
}
