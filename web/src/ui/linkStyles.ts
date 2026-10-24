const primary =
  "inline-flex min-h-11 items-center rounded-[12px] bg-accent font-semibold text-on-accent no-underline hover:text-on-accent";
const large =
  "flex min-h-14 items-center rounded-md font-semibold text-text no-underline hover:text-text";
const largePrimary =
  "flex min-h-14 items-center justify-center rounded-md bg-accent text-lg font-semibold text-on-accent no-underline hover:text-on-accent";

/** Anchor equivalents of primary and secondary actions, without changing link semantics. */
export const linkStyles = {
  primary: `${primary} px-4`,
  centeredPrimary: `${primary} justify-center px-4`,
  rejoin: `${primary} px-5`,
  resume: `${primary} justify-center self-start px-4`,
  largePrimary: `${largePrimary} px-6`,
  host: largePrimary,
  largeSecondary: `${large} justify-center border border-line-strong px-6`,
  responsivePrimary: `${largePrimary} flex-1 px-6 sm:flex-none`,
  responsiveSecondary: `${large} flex-1 justify-center border border-line-strong px-6 sm:flex-none`,
  signIn: `${largePrimary} sm:self-start sm:px-8`,
  largeOutline: `${large} border border-line-strong px-6`,
  secondary:
    "inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-line-strong bg-surface-3 px-4 font-semibold text-text no-underline hover:bg-surface-2 hover:text-text",
} as const;
