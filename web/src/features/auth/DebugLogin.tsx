import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { API_URL } from "@/api/config";
import { Button } from "@/ui/Button";
import { FieldError, TextInput } from "@/ui/Field";

/** Enabled by VITE_DEBUG_LOGIN; the API's existing dev route requires ENV=dev. */
export function DebugLogin() {
  const { t } = useTranslation();
  const [number, setNumber] = useState("1");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = Number(number);
  const valid = Number.isInteger(id) && id >= 1 && id <= 999999;

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!valid || pending) return;
    setPending(true);
    setError(null);
    try {
      // Development routes intentionally stay outside the public OpenAPI contract.
      const response = await fetch(`${API_URL}/v1/dev/login/${id}`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error(t("debugLogin.failed", { status: response.status }));
      // Drop the previous account's queries and game sockets together.
      location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("debugLogin.networkError"));
      setPending(false);
    }
  }

  return (
    <form onSubmit={signIn} className="flex max-w-full flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-sm text-muted">
        {t("debugLogin.number")}
        <TextInput
          className="w-24"
          type="number"
          min={1}
          max={999999}
          step={1}
          required
          value={number}
          disabled={pending}
          onChange={(event) => setNumber(event.target.value)}
        />
      </label>
      <Button type="submit" size="sm" disabled={!valid || pending}>
        {pending ? t("debugLogin.signingIn") : t("debugLogin.signIn")}
      </Button>
      <FieldError>{error}</FieldError>
    </form>
  );
}
