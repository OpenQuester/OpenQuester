import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import type { FileRef } from "@/features/upload/types";
import { emptyPackage } from "../packageDraft";
import { createPackageEditorStore, PackageEditorContext } from "../packageEditorStore";
import { SingleMediaField } from "./SingleMediaField";
import { MediaSessionContext } from "./useStagedMedia";

it("retains the explicit undo for a package-details logo", async () => {
  const store = createPackageEditorStore({
    draftId: "logo-test",
    pkg: emptyPackage("Quiz"),
    media: new Map(),
    savedAt: null,
  });
  function Logo() {
    const [value, setValue] = useState<FileRef | null>({ md5: "logo", type: "image" });
    return <SingleMediaField value={value} onChange={setValue} label="Logo" />;
  }
  render(
    <PackageEditorContext.Provider value={store}>
      <MediaSessionContext.Provider value={() => {}}>
        <Logo />
      </MediaSessionContext.Provider>
    </PackageEditorContext.Provider>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Remove file" }));
  await user.click(screen.getByRole("button", { name: "Undo media change" }));
  expect(screen.getByRole("button", { name: "Remove file" })).toBeInTheDocument();
});
