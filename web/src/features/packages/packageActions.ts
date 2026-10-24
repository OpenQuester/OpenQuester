import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api, unwrap } from "@/api/client";
import { draftFromPackage } from "@/features/editor/fromServer";

/** Loads a published package into an editor draft and opens it. */
export function useOpenInEditor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = async (packageId: number) => {
    setOpening(true);
    setError(null);
    try {
      const draftId = await draftFromPackage(packageId);
      await navigate({ to: "/packages/editor/$draftId", params: { draftId } });
    } catch {
      setError(t("myPackages.openFailed"));
      setOpening(false);
    }
  };
  return { opening, error, open };
}

export function useDeletePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      unwrap(api.DELETE("/v1/packages/{id}", { params: { path: { id } } })),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: ["package", id] });
      void qc.invalidateQueries({ queryKey: ["packages"] });
      void qc.invalidateQueries({ queryKey: ["me", "storage"] });
    },
  });
}
