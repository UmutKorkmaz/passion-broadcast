import { useEffect, useMemo, useRef, useState } from "react";

import type { Broadcast } from "./types";
import {
  BrandMark,
  DocumentIcon,
  ReplayIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from "./icons";

function formatTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

const waveform = [
  8, 13, 19, 24, 13, 28, 17, 31, 22, 35, 16, 27, 38, 21, 14, 31, 42, 19, 24, 34,
  48, 21, 30, 39, 52, 26, 43, 61, 33, 47, 68, 39, 58, 73, 42, 31, 52, 38, 29, 45,
  34, 25, 38, 31, 22, 34, 27, 18, 30, 24, 16, 27, 21, 15, 23, 18, 13, 20, 16, 12,
];

export function AudioPlayer({ broadcast }: { broadcast: Broadcast }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(broadcast.durationSeconds || 0);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const audioUrl = broadcast.audioUrl ?? "/api/audio/latest";
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  const waveformBars = useMemo(
    () => waveform.map((height, index) => ({ height, played: index / waveform.length <= progress })),
    [progress],
  );

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) clearInterval(fallbackTimerRef.current);
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  const beginFallbackSpeech = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const speech = window.speechSynthesis;

    if (speech.paused) {
      speech.resume();
    } else if (!speech.speaking) {
      const utterance = new SpeechSynthesisUtterance(broadcast.transcript);
      utterance.rate = 1;
      utterance.pitch = 0.92;
      utterance.onend = () => {
        setIsPlaying(false);
        setCurrentTime(duration);
      };
      speech.speak(utterance);
    }

    setFallbackMode(true);
    setIsPlaying(true);
    if (fallbackTimerRef.current) clearInterval(fallbackTimerRef.current);
    fallbackTimerRef.current = setInterval(() => {
      setCurrentTime((time) => {
        if (time >= duration) {
          if (fallbackTimerRef.current) clearInterval(fallbackTimerRef.current);
          return duration;
        }
        return time + 1;
      });
    }, 1000);
  };

  const togglePlayback = async () => {
    if (fallbackMode) {
      if (isPlaying) {
        window.speechSynthesis.pause();
        if (fallbackTimerRef.current) clearInterval(fallbackTimerRef.current);
        setIsPlaying(false);
      } else {
        beginFallbackSpeech();
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      beginFallbackSpeech();
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      beginFallbackSpeech();
    }
  };

  const seekTo = (nextTime: number) => {
    const safeTime = Math.min(duration, Math.max(0, nextTime));
    setCurrentTime(safeTime);
    if (!fallbackMode && audioRef.current) audioRef.current.currentTime = safeTime;
  };

  return (
    <aside className="broadcast-player" aria-label={`${broadcast.title} audio player`}>
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="none"
        onLoadedMetadata={(event) => {
          const nextDuration = event.currentTarget.duration;
          if (Number.isFinite(nextDuration)) setDuration(nextDuration);
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onEnded={() => setIsPlaying(false)}
        onError={() => setFallbackMode(true)}
      />

      <div className="broadcast-mark" aria-hidden="true">
        <BrandMark />
      </div>

      <div className="broadcast-meta">
        <h2>{broadcast.title}</h2>
        <p><span>{formatTime(currentTime)}</span><span className="desktop-duration"> / {formatTime(duration)}</span></p>
      </div>

      <div className="broadcast-waveform">
        <div className="wave-bars" aria-hidden="true">
          {waveformBars.map((bar, index) => (
            <i
              key={index}
              className={bar.played ? "is-played" : undefined}
              style={{ height: `${bar.height}%` }}
            />
          ))}
          <b style={{ left: `${progress * 100}%` }} />
        </div>
        <input
          type="range"
          min="0"
          max={duration}
          step="1"
          value={Math.min(currentTime, duration)}
          onChange={(event) => seekTo(Number(event.target.value))}
          aria-label="Audio position"
        />
        <div className="wave-times" aria-hidden="true">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="broadcast-controls">
        <button type="button" onClick={() => seekTo(currentTime - 10)} aria-label="Rewind 10 seconds"><ReplayIcon /></button>
        <button type="button" onClick={() => seekTo(0)} aria-label="Previous"><SkipBackIcon /></button>
        <button
          className="play-button"
          type="button"
          onClick={togglePlayback}
          aria-label={isPlaying ? "Pause broadcast" : "Play broadcast"}
        >
          {isPlaying ? <span className="pause-symbol" /> : <span className="play-symbol" />}
        </button>
        <button type="button" onClick={() => seekTo(duration)} aria-label="Next"><SkipForwardIcon /></button>
        <button className="replay-forward" type="button" onClick={() => seekTo(currentTime + 10)} aria-label="Forward 10 seconds"><ReplayIcon /></button>
      </div>

      <button className="transcript-button" type="button" onClick={() => setTranscriptOpen((open) => !open)} aria-expanded={transcriptOpen}>
        <DocumentIcon />
        {transcriptOpen ? "Hide transcript" : "View transcript"}
      </button>

      {transcriptOpen ? (
        <div className="broadcast-transcript" aria-live="polite">
          <h3>Broadcast transcript</h3>
          <p>{broadcast.transcript}</p>
        </div>
      ) : null}
    </aside>
  );
}
