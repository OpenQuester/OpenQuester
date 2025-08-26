import { UserStatus } from "@server-dto";

export { UserStatus };

export const userStatusOptions: { label: string; value: UserStatus }[] = [
  { label: "Active Only", value: UserStatus.ACTIVE },
  { label: "Banned Only", value: UserStatus.BANNED },
  { label: "Deleted Only", value: UserStatus.DELETED },
] as const;
