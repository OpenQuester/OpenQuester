import { useState, type FormEvent } from "react";
import {
  fromMbInput,
  toMbInput,
  useSetGroupLimits,
  useSetUserQuota,
  type AdminStorage as AdminStorageData,
  type StorageLimits,
} from "@/features/storage/useStorage";

export const FIELDS = [
  "userQuotaBytes",
  "packageBytes",
  "imageBytes",
  "audioBytes",
  "videoBytes",
] as const;

export function useGroupLimitsForm(limits: AdminStorageData["groups"][number]) {
  const save = useSetGroupLimits();
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(FIELDS.map((f) => [f, toMbInput(limits[f])])),
  );
  const parsed = Object.fromEntries(FIELDS.map((f) => [f, fromMbInput(draft[f] ?? "")]));
  const invalid = FIELDS.some((f) => parsed[f] === undefined);
  const dirty = FIELDS.some((f) => parsed[f] !== limits[f]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (invalid || !dirty) return;
    save.mutate({ group: limits.group, limits: parsed as StorageLimits });
  };
  return { save, draft, setDraft, parsed, invalid, dirty, submit };
}

export function useUserQuotaForm(user: AdminStorageData["topUsers"][number]) {
  const save = useSetUserQuota();
  const [value, setValue] = useState(user.quotaOverridden ? toMbInput(user.quotaBytes) : "");
  const bytes = fromMbInput(value);
  const over = user.quotaBytes !== null && user.usedBytes > user.quotaBytes;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (bytes === undefined) return;
    save.mutate({ id: user.id, quotaBytes: bytes });
  };
  return { save, value, setValue, bytes, over, submit };
}
