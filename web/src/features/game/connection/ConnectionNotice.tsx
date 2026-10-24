import { gameEntryStyles } from "../gameEntryStyles";
import { typographyStyles } from "@/ui/typographyStyles";
import { useTranslation } from "react-i18next";

import { Link } from "@tanstack/react-router";
import { PageContainer } from "@/ui/Page";
import { translateServerError } from "@/i18n/serverErrors";
import { Button } from "@/ui/Button";
import { useEffect, useRef } from "react";

export function GameJoinFailure({
  joinError,
  onReset,
}: {
  joinError: string;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  return (
    <PageContainer width={640}>
      <div className={gameEntryStyles.failure} role="alert">
        <h1 className={typographyStyles.sectionTitle}>{t("game.joinFailed")}</h1>
        <p className="m-0 text-soft">
          {translateServerError(joinError === "auth_failed" ? t("game.authFailed") : joinError)}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="accent" onClick={onReset}>
            {t("game.tryAgain")}
          </Button>
          <Link to="/" className="inline-flex min-h-11 items-center px-2">
            {t("game.backHome")}
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}

export function GameSessionTakeover({ onTakeOver }: { onTakeOver: () => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => e.preventDefault()}
      className={`${gameEntryStyles.takeoverOverlay} m-0 h-dvh max-h-none w-screen max-w-none border-0 text-text`}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="taken-over-title"
      aria-describedby="taken-over-help"
      data-testid="taken-over"
    >
      <div className={gameEntryStyles.takeoverMessage}>
        <h2 id="taken-over-title" className={typographyStyles.sectionTitle}>
          {t("game.takenOver")}
        </h2>
        <p id="taken-over-help" className="m-0 text-soft">
          {t("game.takenOverHelp")}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="accent" size="lg" onClick={onTakeOver} autoFocus data-testid="take-over">
            {t("game.takeOver")}
          </Button>
          <Link to="/" className="inline-flex min-h-14 items-center px-2">
            {t("game.backHome")}
          </Link>
        </div>
      </div>
    </dialog>
  );
}
