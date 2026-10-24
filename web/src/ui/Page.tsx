import type { ReactNode } from "react";

export function PageContainer({ children, width = 1240 }: { children: ReactNode; width?: number }) {
  return (
    <div className="mx-auto w-full px-4 pb-16 pt-6 sm:px-6 sm:pt-10" style={{ maxWidth: width }}>
      {children}
    </div>
  );
}

export function PageTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h1 id={id} className="m-0 font-display text-4xl font-extrabold tracking-tight">
      {children}
    </h1>
  );
}

/** Full-screen route feedback, outside the normal application header. */
export function PageMessage({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-16">
      <h1 className="m-0 font-display text-3xl font-extrabold">{title}</h1>
      {children}
    </div>
  );
}

export function PageLoading({ children }: { children: ReactNode }) {
  return <div className="grid min-h-dvh place-items-center">{children}</div>;
}
