import * as Dialog from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { CloseIcon } from "@/ui/icons";
import { dialogStyles } from "@/ui/dialogStyles";
import { mapUrl } from "@/lib/urlMappings";

export function AvatarDialog({
  name,
  src,
  open,
  onOpenChange,
  restoreFocus,
}: {
  name: string;
  src: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => HTMLElement | null;
}) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={`${dialogStyles.overlay} z-[80] backdrop-blur-md`} />
        <Dialog.Content
          className="player-avatar-dialog"
          data-avatar-dialog
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreFocus()?.focus({ preventScroll: true });
          }}
        >
          <div className="flex min-w-0 items-center gap-3 p-3">
            <Dialog.Title className="m-0 min-w-0 flex-1 truncate text-base font-semibold">
              {name}
            </Dialog.Title>
            <Dialog.Close
              className={dialogStyles.standardCloseButton}
              aria-label={t("common.close")}
            >
              <CloseIcon size={18} />
            </Dialog.Close>
          </div>
          <img
            src={mapUrl(src)}
            alt={t("players.avatar", { name })}
            className="min-h-0 h-full w-full object-contain p-3 pt-0"
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
