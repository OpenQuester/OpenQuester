import { UserType } from "@server-dto";

export const userTypeOptions: { label: string; value: UserType }[] = [
  { label: "Registered Users", value: UserType.REGISTERED },
  { label: "Guest Users", value: UserType.GUEST },
] as const;
