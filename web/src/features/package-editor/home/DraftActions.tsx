import { useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ACCEPT } from "@/features/upload/upload";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { PlusIcon, UploadIcon } from "@/ui/icons";
import type { useDraftLibrary } from "./useDraftLibrary";

export function DraftActions({
  busy,
  create,
  importFile,
}: Pick<ReturnType<typeof useDraftLibrary>, "busy" | "create" | "importFile">) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <DraftActionCard title={t("editor.home.newTitle")} help={t("editor.home.newHelp")}>
        <Button
          variant="accent"
          size="lg"
          icon={<PlusIcon size={20} />}
          onClick={() => void create()}
          disabled={busy != null}
          data-testid="new-package"
        >
          {t("editor.home.new")}
        </Button>
      </DraftActionCard>
      <DraftActionCard title={t("editor.home.importTitle")} help={t("editor.home.importHelp")}>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          aria-hidden
          tabIndex={-1}
          data-testid="import-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void importFile(f);
          }}
        />
        <Button
          size="lg"
          icon={<UploadIcon size={20} />}
          data-import-picker
          onClick={() => input.current?.click()}
          disabled={busy != null}
        >
          {t("editor.home.import")}
        </Button>
      </DraftActionCard>
    </div>
  );
}

function DraftActionCard({
  title,
  help,
  children,
}: {
  title: string;
  help: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="flex h-full flex-col gap-3">
        <p className="m-0 font-semibold">{title}</p>
        <p className="m-0 flex-1 text-sm text-muted">{help}</p>
        {children}
      </div>
    </Card>
  );
}
