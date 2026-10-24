import { layoutStyles } from "@/ui/layoutStyles";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "@/i18n/index";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { FieldGroup, inputClass, Select, TextInput } from "@/ui/Field";
import { LinesField } from "../LinesField";
import type { AgeRestriction } from "../packageDraft";
import { StagedMediaContext } from "../packageEditorStore";
import { SingleMediaField } from "../media-editor/SingleMediaField";
import { MediaSessionContext } from "../media-editor/useStagedMedia";
import { usePackageDetails } from "./usePackageDetails";

export function PackageDetailsForm({
  onClose,
  requestCloseRef,
}: {
  onClose: () => void;
  requestCloseRef: RefObject<(() => void) | null>;
}) {
  const { t } = useTranslation();
  const { details, setDetails, tags, setTags, media, confirmClose, setConfirmClose, save } =
    usePackageDetails(onClose, requestCloseRef);
  return (
    <StagedMediaContext.Provider value={media.pending}>
      <MediaSessionContext.Provider value={media.open}>
        {media.node}
        <form
          className={media.active ? "hidden" : layoutStyles.cardBody}
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <SingleMediaField
            value={details.logo}
            onChange={(logo) => setDetails((old) => ({ ...old, logo }))}
            label={t("mediaEditor.logo")}
          />
          <FieldGroup htmlFor="pd-title" label={t("editor.details.name")}>
            <TextInput
              id="pd-title"
              value={details.title}
              onChange={(e) => setDetails({ ...details, title: e.target.value })}
            />
          </FieldGroup>
          <FieldGroup
            htmlFor="pd-desc"
            label={
              <>
                {t("editor.details.description")}{" "}
                <span className="font-normal text-faint">{t("editor.optional")}</span>
              </>
            }
          >
            <textarea
              id="pd-desc"
              rows={3}
              value={details.description}
              onChange={(e) => setDetails({ ...details, description: e.target.value })}
              className={cn(inputClass, "resize-y py-3")}
            />
          </FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldGroup htmlFor="pd-lang" label={t("editor.details.language")}>
              <Select
                id="pd-lang"
                value={details.language}
                onChange={(e) => setDetails({ ...details, language: e.target.value })}
              >
                <option value="">{t("editor.details.noLanguage")}</option>
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </FieldGroup>
            <FieldGroup htmlFor="pd-age" label={t("editor.details.age")}>
              <Select
                id="pd-age"
                value={details.ageRestriction}
                onChange={(e) =>
                  setDetails({ ...details, ageRestriction: e.target.value as AgeRestriction })
                }
              >
                <option value="NONE">{t("create.ageNone")}</option>
                <option value="A12">12+</option>
                <option value="A16">16+</option>
                <option value="A18">18+</option>
              </Select>
            </FieldGroup>
          </div>
          <FieldGroup
            htmlFor="pd-tags"
            label={t("editor.details.tags")}
            help={t("editor.details.tagsHelp")}
          >
            <TextInput
              id="pd-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t("editor.details.tagsPlaceholder")}
            />
          </FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <LinesField
              id="pd-authors"
              label={t("editor.form.authors")}
              help={t("editor.details.authorsHelp")}
              value={details.authors}
              onChange={(authors) => setDetails({ ...details, authors })}
            />
            <LinesField
              id="pd-sources"
              label={t("editor.form.sources")}
              help={t("editor.form.sourcesHelp")}
              value={details.sources}
              onChange={(sources) => setDetails({ ...details, sources })}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="accent" size="lg">
              {t("mediaEditor.saveDetails")}
            </Button>
            <Button size="lg" variant="ghost" onClick={() => requestCloseRef.current?.()}>
              {t("editor.cancel")}
            </Button>
          </div>
          {confirmClose && (
            <div className={layoutStyles.actions} role="alert">
              <span className="text-warning">{t("editor.form.unsaved")}</span>
              <Button variant="danger" onClick={onClose}>
                {t("editor.form.discard")}
              </Button>
              <Button onClick={() => setConfirmClose(false)}>{t("editor.form.keepEditing")}</Button>
            </div>
          )}
        </form>
      </MediaSessionContext.Provider>
    </StagedMediaContext.Provider>
  );
}
