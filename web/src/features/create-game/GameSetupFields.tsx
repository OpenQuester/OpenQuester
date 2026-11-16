import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import { Label, TextInput } from "@/ui/Field";
import { RadioButton } from "@/ui/RadioButton";
import { createGameStyles } from "./createGameStyles";
import { PasswordInput } from "@/ui/PasswordInput";
import type { CreateGameForm } from "./useCreateGame";
import { MAX_GAME_SLOTS, MIN_GAME_SLOTS } from "./gameSettings";

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
          <TextInput
            id="g-max"
            type="number"
            min={MIN_GAME_SLOTS}
            max={MAX_GAME_SLOTS}
            aria-describedby="g-max-help"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(e.target.value)}
          />
          <span id="g-max-help" className="text-sm text-muted">
            {MIN_GAME_SLOTS}–{MAX_GAME_SLOTS}
          </span>
        </div>
        <div className={createGameStyles.setupField}>
          <span id="g-age" className="text-[15px] font-semibold">
            {t("create.age")}
          </span>
          <div role="radiogroup" aria-labelledby="g-age" className="flex flex-wrap gap-1.5">
            {(["NONE", "A12", "A16", "A18"] as const).map((rating) => (
              <RadioButton key={rating} checked={age === rating} onClick={() => setAge(rating)}>
                {rating === "NONE" ? t("create.ageNone") : `${rating.slice(1)}+`}
              </RadioButton>
            ))}
          </div>
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
