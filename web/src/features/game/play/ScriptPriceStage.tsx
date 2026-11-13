import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useGame, useSession } from "../GameContext";
import { Button } from "@/ui/Button";
import { myRole } from "@/game/selectors";
import { stageStyles } from "./stages/stageStyles";

/** A NumberSet stays a bounded numeric input even when it contains a million possible values. */
export function ScriptPriceStage() {
  const { t } = useTranslation();
  const session = useSession();
  const { myId, connection } = useGame();
  const wait = session.state.scriptView;
  const range = wait?.priceRange;
  const [value, setValue] = useState(String(range?.min ?? ""));
  const number = Number(value);
  const permitted = myRole(session, myId) === "showman" || wait?.actorId === myId;
  const valid =
    !!range &&
    value.trim() !== "" &&
    Number.isSafeInteger(number) &&
    number >= range.min &&
    number <= range.max &&
    (range.step === 0 || (number - range.min) % range.step === 0);
  return (
    <section className={stageStyles.secretPrice}>
      <h2>{t("script.choosePrice")}</h2>
      {permitted && range ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) connection.emit("secret-question-price", { price: number });
          }}
        >
          <label className="flex flex-col gap-2">
            {t("script.priceRange", { ...range })}
            <input
              type="number"
              min={range.min}
              max={range.max}
              step={range.step || 1}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
          <Button type="submit" disabled={!valid || session.state.isPaused}>
            {t("script.confirmPrice")}
          </Button>
        </form>
      ) : (
        <p>{t("script.waitPrice")}</p>
      )}
    </section>
  );
}
