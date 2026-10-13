import type { SVGProps } from "react";

function Icon({ children, size = 20, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const BackIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M15 18l-6-6 6-6" />
  </Icon>
);
export const MenuIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Icon>
);
export const CloseIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
export const ChatIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
  </Icon>
);
export const CheckIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M5 12l5 5L20 7" />
  </Icon>
);
export const CopyIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </Icon>
);
export const SearchIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Icon>
);
export const UsersIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3" />
  </Icon>
);
export const PauseIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M9 5v14M15 5v14" />
  </Icon>
);
export const PlayIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M7 4l13 8-13 8z" />
  </Icon>
);
export const LockIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Icon>
);
export const MoreIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </Icon>
);
export const VolumeIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
  </Icon>
);
export const EyeIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
export const UploadIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </Icon>
);
