import { PointPicker, type PointMarker, type Spot } from "../PointPicker";

/** The target and every player's point share the same image coordinates. */
export function PointResults({
  src,
  target,
  radius,
  markers,
}: {
  src: string;
  target: Spot;
  radius?: number | null;
  markers: PointMarker[];
}) {
  return (
    <div
      className="relative flex h-[60dvh] min-h-0 w-full flex-auto items-center justify-center overflow-hidden [container-type:size]"
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
