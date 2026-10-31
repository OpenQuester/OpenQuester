import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import type { AgeRestriction } from "@/api/types";
import { Label, Select, TextInput } from "@/ui/Field";
import { RadioButton } from "@/ui/RadioButton";
import { createGameStyles } from "./createGameStyles";
import { PasswordInput } from "@/ui/PasswordInput";
import type { CreateGameForm } from "./useCreateGame";

export function GameSetupFields({ form }: { form: CreateGameForm }) {
  const { t } = useTranslation();
  const {
    title,
    setTitle,
    defaultTitle,
    maxPlayers,
    setMaxPlayers,
    age,
    setAge,
    isPrivate,
    setIsPrivate,
    password,
    setPassword,
  } = form;
  return (
    <section className={createGameStyles.section}>
      <div className={createGameStyles.field}>
        <Label htmlFor="g-title">{t("create.name")}</Label>
        <TextInput
          id="g-title"
          value={title}
          maxLength={100}
          placeholder={defaultTitle}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-4">
        <div className={createGameStyles.setupField}>
          <Label htmlFor="g-max">{t("create.players")}</Label>
          <Select
            id="g-max"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
          >
            {Array.from({ length: 14 }, (_, i) => i + 2).map((n) => (
              <option key={n} value={n}>
                {t("create.upTo", { count: n })}
              </option>
            ))}
          </Select>
        </div>
        <div className={createGameStyles.setupField}>
          <Label htmlFor="g-age">{t("create.age")}</Label>
          <Select id="g-age" value={age} onChange={(e) => setAge(e.target.value as AgeRestriction)}>
            <option value="NONE">{t("create.ageNone")}</option>
            <option value="A12">12+</option>
            <option value="A16">16+</option>
            <option value="A18">18+</option>
          </Select>
        </div>
      </div>
      <fieldset className={layoutStyles.optionGroup}>
        <legend className="mb-2 text-[15px] font-semibold">{t("create.whoCanJoin")}</legend>
        <div role="radiogroup" aria-label={t("create.whoCanJoin")} className="flex gap-2">
          {[false, true].map((priv) => (
            <RadioButton
              key={String(priv)}
              checked={isPrivate === priv}
              onClick={() => setIsPrivate(priv)}
            >
              {priv ? t("create.private") : t("create.public")}
            </RadioButton>
          ))}
        </div>
      </fieldset>
      {isPrivate && (
        <div className={createGameStyles.field}>
          <Label htmlFor="g-pass">{t("create.password")}</Label>
          <PasswordInput
            id="g-pass"
            value={password}
            maxLength={16}
            autoComplete="off"
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("create.passwordPlaceholder")}
          />
          <p className="m-0 text-sm text-muted">{t("create.passwordHelp")}</p>
        </div>
      )}
    </section>
  );
}
