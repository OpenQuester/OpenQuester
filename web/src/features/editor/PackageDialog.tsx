import { useState } from "react";
import { useTranslation } from "react-i18next";

import { LANGUAGES } from "@/i18n";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { inputClass, Label, Select, TextInput } from "@/ui/Field";
import { cn } from "@/lib/cn";

import type { AgeRestriction, EditorPackage } from "./model";
import { useEditor } from "./store";

/** Title, description, language, age rating and tags: one undo step on Save. */
export function PackageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t("editor.details.title")}
      closeLabel={t("common.close")}
    >
      {open && <DetailsForm onClose={onClose} />}
    </Dialog>
  );
}

function DetailsForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const pkg = useEditor((s) => s.pkg);
  const apply = useEditor((s) => s.apply);
  const [d, setD] =
    useState<Pick<EditorPackage, "title" | "description" | "language" | "ageRestriction">>(pkg);
  const [tags, setTags] = useState(pkg.tags.join(", "));
  const save = () => {
    const tagList = [
      ...new Set(
        tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
    apply((p) => ({ ...p, ...d, tags: tagList }), { key: "detailsSaved" });
    onClose();
  };
  return (
    <form
      className="flex flex-col gap-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pd-title">{t("editor.details.name")}</Label>
        <TextInput
          id="pd-title"
          value={d.title}
          onChange={(e) => setD({ ...d, title: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pd-desc">
          {t("editor.details.description")}{" "}
          <span className="font-normal text-faint">{t("editor.optional")}</span>
        </Label>
        <textarea
          id="pd-desc"
          rows={3}
          value={d.description}
          onChange={(e) => setD({ ...d, description: e.target.value })}
          className={cn(inputClass, "resize-y py-3")}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pd-lang">{t("editor.details.language")}</Label>
          <Select
            id="pd-lang"
            value={d.language}
            onChange={(e) => setD({ ...d, language: e.target.value })}
          >
            <option value="">{t("editor.details.noLanguage")}</option>
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pd-age">{t("editor.details.age")}</Label>
          <Select
            id="pd-age"
            value={d.ageRestriction}
            onChange={(e) => setD({ ...d, ageRestriction: e.target.value as AgeRestriction })}
          >
            <option value="NONE">{t("create.ageNone")}</option>
            <option value="A12">12+</option>
            <option value="A16">16+</option>
            <option value="A18">18+</option>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pd-tags">{t("editor.details.tags")}</Label>
        <TextInput
          id="pd-tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder={t("editor.details.tagsPlaceholder")}
        />
        <span className="text-sm text-faint">{t("editor.details.tagsHelp")}</span>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="accent" size="lg">
          {t("editor.form.save")}
        </Button>
        <Button size="lg" variant="ghost" onClick={onClose}>
          {t("editor.cancel")}
        </Button>
      </div>
    </form>
  );
}
