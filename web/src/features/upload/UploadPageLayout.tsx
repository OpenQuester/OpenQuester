import { layoutStyles } from "@/ui/layoutStyles";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { PageContainer, PageTitle } from "@/ui/Page";
import { BackIcon } from "@/ui/icons";

export function UploadPageLayout({
  title,
  description,
  backTo,
  backLabel,
  children,
}: {
  title: string;
  description?: ReactNode;
  backTo: "/packages" | "/packages/mine";
  backLabel: string;
  children: ReactNode;
}) {
  return (
    <PageContainer width={880}>
      <div className="flex flex-col gap-6">
        <Link to={backTo} className={layoutStyles.backLink}>
          <BackIcon size={18} />
          {backLabel}
        </Link>
        <header className="flex flex-col gap-2">
          <PageTitle>{title}</PageTitle>
          {description}
        </header>
        {children}
      </div>
    </PageContainer>
  );
}
