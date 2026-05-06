import { useTranslations } from "next-intl";

import { Slider } from "@/components/ui/slider";

interface WaveformVisualizerProps {
  progress: number;
  onSeek: (value: number[]) => void;
  /**
   * Bar heights as percentages 0-100. Sourced from a live AnalyserNode while
   * audio is playing. `null` means we have no live data yet (pre-playback or
   * paused before any playback) — render a flat baseline rather than fake data.
   */
  barHeights?: number[] | null;
  /** Stable target bar count so the layout doesn't reflow when data arrives. */
  barCount: number;
  isLoading?: boolean;
}

const BASELINE_HEIGHT_PERCENT = 8;

const WaveformVisualizer = ({ progress, onSeek, barHeights, barCount, isLoading = false }: WaveformVisualizerProps) => {
  const t = useTranslations();

  // No live data yet → uniform low baseline. Honest placeholder; not pseudo-data.
  const heights: number[] =
    barHeights && barHeights.length > 0 ? barHeights : Array.from({ length: barCount }, () => BASELINE_HEIGHT_PERCENT);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = (clickX / rect.width) * 100;
    onSeek([percentage]);
  };

  if (isLoading) {
    return (
      <div className="relative">
        <div className="flex items-center justify-center h-24 bg-muted rounded-md">
          <div className="animate-pulse text-muted-foreground">{t("filePreview.loadingAudio")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        className="hidden sm:flex items-end justify-center h-24 gap-[2px] cursor-pointer rounded-md"
        onClick={handleClick}
      >
        {heights.map((height, index) => {
          const isActive = (index / heights.length) * 100 <= progress;
          return (
            <div
              key={index}
              className={`w-[2px] rounded-sm transition-all duration-100 ${
                isActive ? "bg-primary" : "bg-muted-foreground/20"
              }`}
              style={{
                height: `${height}%`,
                minHeight: "2px",
              }}
            />
          );
        })}
      </div>

      <div className="sm:hidden w-full py-8">
        <Slider value={[progress]} onValueChange={onSeek} max={100} step={0.1} className="w-full" />
      </div>
    </div>
  );
};

export default WaveformVisualizer;
