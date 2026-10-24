/** The OpenQuester logo, the same artwork as the favicon and app icons. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <img
      src="/favicon.svg"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="shrink-0"
    />
  );
}
