"use client"

import * as React from "react"
import { IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"

export function AudioPlayer({
  src,
  label = "Original voice memo",
}: {
  src: string
  label?: string
}) {
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = React.useState(false)

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      void audio.play()
    } else {
      audio.pause()
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-muted/40 p-3">
      <Button
        type="button"
        variant="secondary"
        size="icon-lg"
        onClick={toggle}
        aria-label={isPlaying ? `Pause ${label}` : `Play ${label}`}
      >
        {isPlaying ? (
          <IconPlayerPause aria-hidden />
        ) : (
          <IconPlayerPlay aria-hidden />
        )}
      </Button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <audio
          ref={audioRef}
          src={src}
          controls
          preload="none"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          className="mt-1 h-9 w-full"
        />
      </div>
    </div>
  )
}
