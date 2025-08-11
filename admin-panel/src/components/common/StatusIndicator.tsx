interface StatusIndicatorProps {
  label: string;
  status: "online" | "offline" | "warning";
  value?: string;
}

export const StatusIndicator = ({
  label,
  status,
  value,
}: StatusIndicatorProps) => (
  <div className="flex items-center justify-between py-3">
    <div className="flex items-center space-x-3">
      <div
        className={`w-3 h-3 rounded-full ${
          status === "online"
            ? "bg-success-500"
            : status === "warning"
            ? "bg-warning-500"
            : "bg-error-500"
        }`}
      ></div>
      <span className="text-sm font-medium text-secondaryText">{label}</span>
    </div>
    {value && <span className="text-sm text-mutedText">{value}</span>}
  </div>
);
