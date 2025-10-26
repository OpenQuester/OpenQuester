import { Modal } from "@/components/common/Modal";

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "danger" | "warning" | "primary";
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog = ({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "primary",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) => {
  const getConfirmVariantClasses = () => {
    switch (confirmVariant) {
      case "danger":
        return "btn-danger";
      case "warning":
        return "btn bg-warning-600 text-white hover:bg-warning-700 focus:ring-warning-500 active:bg-warning-800";
      case "primary":
      default:
        return "btn-primary";
    }
  };

  const footer = (
    <div className="flex justify-end gap-3">
      <button
        type="button"
        onClick={onCancel}
        disabled={isLoading}
        className="btn-secondary"
      >
        {cancelText}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={isLoading}
        className={getConfirmVariantClasses()}
      >
        {isLoading ? "Loading..." : confirmText}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      onClose={onCancel}
      footer={footer}
      size="sm"
    >
      <div className="text-secondaryText">{message}</div>
    </Modal>
  );
};
