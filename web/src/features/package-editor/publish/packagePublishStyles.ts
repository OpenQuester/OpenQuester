import { layoutStyles } from "@/ui/layoutStyles";
import { linkStyles } from "@/ui/linkStyles";

export const packagePublishStyles = {
  issueGroupTitle: "m-0 text-sm font-bold tracking-wider text-faint uppercase",
  issues: layoutStyles.compactList,
  issue: "flex w-full flex-col gap-0.5 rounded-sm border px-3 py-2 text-left",
  playLink: linkStyles.largePrimary,
  packageLink: linkStyles.largeSecondary,
} as const;
