import { type ReactNode } from "react";

interface DetailCardProps {
  title: string;
  description: string;
  children: ReactNode;
}

export const DetailCard = ({
  title,
  description,
  children,
}: DetailCardProps) => (
  <div className="card">
    <div className="border-b border-border px-6 py-4">
      <h3 className="text-lg font-semibold text-primaryText">{title}</h3>
      <p className="text-sm text-secondaryText mt-1">{description}</p>
    </div>
    <div className="p-6">{children}</div>
  </div>
);
