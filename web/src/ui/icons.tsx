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
export const SaveIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M5 3h12l4 4v14H3V3h2zM7 3v6h9V3M7 21v-8h10v8" />
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
export const TrimLeftIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M19 4v16M19 12H4M9 7l-5 5 5 5" />
  </Icon>
);
export const TrimRightIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M5 4v16M5 12h15M15 7l5 5-5 5" />
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
export const VolumeOffIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M11 5L6 9H3v6h3l5 4V5zM16 9l5 6M21 9l-5 6" />
  </Icon>
);
export const FullscreenIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
  </Icon>
);
export const EyeIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
export const EyeOffIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM3 3l18 18" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
export const UploadIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </Icon>
);
export const PlusIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const TrashIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </Icon>
);
export const GripIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <circle cx="9" cy="6" r="1" />
    <circle cx="15" cy="6" r="1" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="9" cy="18" r="1" />
    <circle cx="15" cy="18" r="1" />
  </Icon>
);
export const ImageIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 16l5-4 4 3 3-2 6 4" />
  </Icon>
);
export const VideoIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="M16 10l5-3v10l-5-3" />
  </Icon>
);
export const UndoIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />
  </Icon>
);
export const RedoIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" />
  </Icon>
);
export const EditIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />
  </Icon>
);
export const DownloadIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M12 4v12M7 11l5 5 5-5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </Icon>
);
export const MoveIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M5 9l-3 3 3 3M19 9l3 3-3 3M9 5l3-3 3 3M9 19l3 3 3-3M2 12h20M12 2v20" />
  </Icon>
);
export const ChevronIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M9 6l6 6-6 6" />
  </Icon>
);
export const AlertIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M12 3l10 18H2zM12 10v5M12 18v.5" />
  </Icon>
);
export const CardsIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <rect x="3" y="4" width="8" height="7" rx="1.5" />
    <rect x="13" y="4" width="8" height="7" rx="1.5" />
    <rect x="3" y="13" width="8" height="7" rx="1.5" />
    <rect x="13" y="13" width="8" height="7" rx="1.5" />
  </Icon>
);
export const ListIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.5M3 12h.5M3 18h.5" />
  </Icon>
);
export const OutlineIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M4 5h16M8 10h12M8 15h12M4 20h16" />
  </Icon>
);
export const PinIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M12 17v5M9 3h6l-1 6 4 4H6l4-4z" />
  </Icon>
);
export const ReplayIcon = (p: { size?: number }) => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </Icon>
);
