import { cn } from "@/lib/cn";
import { PointPicker, type PointMarker, type Spot } from "../PointPicker";

/** The target and every player's point share the same image coordinates. */
export function PointResults({
  src,
  target,
  radius,
  markers,
  compact = false,
}: {
  src: string;
  target: Spot;
  radius?: number | null;
  markers: PointMarker[];
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-0 w-full flex-auto items-center justify-center overflow-hidden [container-type:size]",
        compact ? "h-36" : "h-[60dvh]",
      )}
      data-testid="point-result-image"
    >
      <PointPicker
        fitFrame
        src={src}
        target={target}
        radius={radius}
        markers={markers}
        className="self-center"
      />
    </div>
  );
}
