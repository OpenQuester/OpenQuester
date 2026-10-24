export const appShellStyles = {
  header: "mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6",
  homeLink: "flex items-center gap-2.5 text-text no-underline hover:text-text",
  navigation:
    "order-3 flex w-full min-w-0 gap-1 overflow-x-auto [scrollbar-width:none] sm:order-none sm:w-auto",
  navigationLink:
    "shrink-0 whitespace-nowrap rounded-sm px-2.5 py-2.5 font-medium no-underline sm:px-3.5",
  accountLink:
    "flex items-center gap-2 rounded-full border border-line-strong bg-surface-3 py-0.5 pl-0.5 pr-3 text-text no-underline hover:text-text",
  signInLink:
    "rounded-[12px] border border-line-strong px-4 py-2.5 font-semibold text-text no-underline hover:text-text",
  skipLink: "sr-only-focusable absolute left-2 top-2 z-50 rounded bg-surface-2 px-3 py-2",
} as const;
