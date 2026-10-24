import { homeStyles } from "./homeStyles";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import { FieldError, TextInput } from "@/ui/Field";
import type { HomeModel } from "./useHomePage";

export function JoinOrHost({
  code,
  setCode,
  codeError,
  setCodeError,
  onJoin,
}: Pick<HomeModel, "code" | "setCode" | "codeError" | "setCodeError" | "onJoin">) {
  const { t } = useTranslation();
  return (
    <section className={homeStyles.entryColumns}>
      <div className={homeStyles.joinPanel}>
        <h1 className={homeStyles.heroTitle}>{t("home.joinTitle")}</h1>
        <p className="m-0 max-w-[62ch] text-muted">{t("home.joinSubtitle")}</p>
        <form onSubmit={onJoin} className="flex flex-wrap gap-3" noValidate>
          <label htmlFor="game-code" className="sr-only">
            {t("home.codeLabel")}
          </label>
          <TextInput
            id="game-code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setCodeError(null);
            }}
            placeholder={t("home.codeLabel")}
            className={homeStyles.codeInput}
            autoCapitalize="characters"
            aria-invalid={codeError ? true : undefined}
            aria-describedby={codeError ? "code-error" : undefined}
          />
          <Button type="submit" variant="accent" size="lg">
            {t("home.join")}
          </Button>
        </form>
        <FieldError id="code-error">{codeError}</FieldError>
      </div>
      <div className={homeStyles.hostPanel}>
        <div className="flex flex-col gap-2">
          <h2 className={homeStyles.hostTitle}>{t("home.hostTitle")}</h2>
          <p className="m-0 max-w-[48ch] text-muted">{t("home.hostSubtitle")}</p>
        </div>
        <Link to="/packages" className={homeStyles.hostLink}>
          {t("home.createGame")}
        </Link>
      </div>
    </section>
  );
}
