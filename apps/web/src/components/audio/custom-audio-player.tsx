import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconPlayerPause, IconPlayerPlay, IconVolume, IconVolume3, IconVolumeOff } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatTime } from "@/utils/format-time";
import WaveformVisualizer from "./waveform-visualizer";

interface CustomAudioPlayerProps {
  src: string;
}

const TARGET_BARS = 200;
const ANALYSER_FFT_SIZE = 512; // → 256 frequency bins
const TICK_INTERVAL_MS = 50; // 20fps; cheap enough for 200-element React reconciliation

export function CustomAudioPlayer({ src }: CustomAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [analyserData, setAnalyserData] = useState<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const audioRef = useRef<HTMLAudioElement>(null);
  const previousVolume = useRef(1);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setupAudioGraph = useCallback(() => {
    if (audioContextRef.current || !audioRef.current) return;

    const Ctx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const source = ctx.createMediaElementSource(audioRef.current);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = ANALYSER_FFT_SIZE;
    source.connect(analyser);
    analyser.connect(ctx.destination);

    audioContextRef.current = ctx;
    sourceRef.current = source;
    analyserRef.current = analyser;
  }, []);

  const startTicking = useCallback(() => {
    if (tickRef.current !== null) return;
    tickRef.current = setInterval(() => {
      const analyser = analyserRef.current;
      if (!analyser) return;
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      setAnalyserData(data);
    }, TICK_INTERVAL_MS);
  }, []);

  const stopTicking = useCallback(() => {
    if (tickRef.current !== null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      if (!audio.duration) return;
      setProgress((audio.currentTime / audio.duration) * 100);
      setCurrentTime(audio.currentTime);
    };
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };
    const handlePlay = () => {
      setIsPlaying(true);
      setupAudioGraph();
      // AudioContext may be suspended by autoplay policy until a user gesture.
      const ctx = audioContextRef.current;
      if (ctx?.state === "suspended") {
        void ctx.resume();
      }
      startTicking();
    };
    const handlePauseOrEnd = () => {
      setIsPlaying(false);
      stopTicking();
    };

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePauseOrEnd);
    audio.addEventListener("ended", handlePauseOrEnd);

    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePauseOrEnd);
      audio.removeEventListener("ended", handlePauseOrEnd);
    };
  }, [setupAudioGraph, startTicking, stopTicking]);

  useEffect(() => {
    const ctxRef = audioContextRef;
    return () => {
      stopTicking();
      void ctxRef.current?.close();
      ctxRef.current = null;
      sourceRef.current = null;
      analyserRef.current = null;
    };
  }, [stopTicking]);

  // Convert live frequency analyser bytes into a fixed bar-height array.
  // Sampling stride keeps the visualizer's element count constant regardless of FFT size.
  const barHeights = useMemo<number[] | null>(() => {
    if (!analyserData || analyserData.length === 0) return null;
    const stride = Math.max(1, Math.floor(analyserData.length / TARGET_BARS));
    const heights: number[] = [];
    for (let i = 0; i < analyserData.length && heights.length < TARGET_BARS; i += stride) {
      heights.push(Math.max(8, (analyserData[i] / 255) * 100));
    }
    return heights;
  }, [analyserData]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      void audio.play();
    }
  };

  const handleSeek = ([percentage]: number[]) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = (percentage / 100) * audioRef.current.duration;
    setProgress(percentage);
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    if (!audioRef.current) return;
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
    if (newVolume > 0) {
      previousVolume.current = newVolume;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (volume > 0) {
      handleVolumeChange([0]);
    } else {
      handleVolumeChange([previousVolume.current]);
    }
  };

  const VolumeIcon = volume === 0 ? IconVolumeOff : volume < 0.5 ? IconVolume3 : IconVolume;

  return (
    <div className="flex flex-col gap-2 w-full">
      <audio ref={audioRef} src={src} preload="metadata" crossOrigin="anonymous" />

      <WaveformVisualizer
        progress={progress}
        onSeek={handleSeek}
        barHeights={barHeights}
        barCount={TARGET_BARS}
        isLoading={isLoading}
      />

      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={togglePlayPause} disabled={isLoading} className="h-8 w-8">
          {isPlaying ? <IconPlayerPause className="h-4 w-4" /> : <IconPlayerPlay className="h-4 w-4" />}
        </Button>

        <div className="text-sm text-muted-foreground space-x-1">
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="icon" onClick={toggleMute} className="h-8 w-8">
            <VolumeIcon className="h-4 w-4" />
          </Button>
          <Slider value={[volume]} max={1} step={0.01} onValueChange={handleVolumeChange} className="w-24" />
        </div>
      </div>
    </div>
  );
}
