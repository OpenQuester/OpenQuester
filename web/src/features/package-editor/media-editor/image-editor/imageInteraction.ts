import {
  annotationBounds,
  fullImage,
  unrotate,
  type ImageAnnotation,
  type ImageEdits,
  type ImagePoint,
} from "../mediaEdits";

/** Map the displayed rotated/cropped canvas back into the original image coordinates. */
export function imagePoint(
  pointer: ImagePoint,
  rect: { left: number; top: number; width: number; height: number },
  bitmap: { width: number; height: number },
  edits: ImageEdits,
  clamp = true,
): ImagePoint {
  const crop = edits.crop ?? fullImage;
  const point = unrotate(
    {
      x: Math.max(0, Math.min(1, (pointer.x - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (pointer.y - rect.top) / rect.height)),
    },
    edits.rotation,
    bitmap.width * crop.width,
    bitmap.height * crop.height,
  );
  return {
    x: crop.x + (clamp ? Math.max(0, Math.min(1, point.x)) : point.x) * crop.width,
    y: crop.y + (clamp ? Math.max(0, Math.min(1, point.y)) : point.y) * crop.height,
  };
}

export function annotationAt(annotations: ImageAnnotation[], point: ImagePoint) {
  return [...annotations].reverse().find((annotation) => {
    const bounds = annotationBounds(annotation);
    return (
      point.x >= bounds.x - 0.02 &&
      point.x <= bounds.x + bounds.width + 0.02 &&
      point.y >= bounds.y - 0.02 &&
      point.y <= bounds.y + bounds.height + 0.02
    );
  });
}

/** Clamp the whole annotation as a unit, preserving its shape at image edges. */
export function dragAnnotation(
  annotation: ImageAnnotation,
  start: ImagePoint,
  point: ImagePoint,
): ImageAnnotation {
  const xs = annotation.points.map((p) => p.x),
    ys = annotation.points.map((p) => p.y);
  const dx = Math.max(-Math.min(...xs), Math.min(point.x - start.x, 1 - Math.max(...xs)));
  const dy = Math.max(-Math.min(...ys), Math.min(point.y - start.y, 1 - Math.max(...ys)));
  return {
    ...annotation,
    points: annotation.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
  };
}
