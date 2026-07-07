# Package Editor Rewrite Plan

## Summary

Rewrite the package editor in `client/packages/oq_editor` and the app upload
adapter in `client/apps/client/lib/src/features/package_editor`. The backend and
OpenAPI contracts stay unchanged.

The editor must follow clean Dart/Flutter architecture: domain logic is separate
from UI, app-specific dependencies enter through explicit ports/adapters, widgets
stay declarative, and long-running operations expose one typed state pipeline.

## Architecture

- `domain/`: editor selection, validation, operation state, operation events.
- `application/`: controller/use cases for edit commands, operation orchestration,
  and media registry behavior.
- `infrastructure/`: `.oq` archive implementation, SIQ import adapter, encoder
  adapter, and file picker integration.
- `view/`: responsive Flutter shell, outline tree, editor panes, preview panes,
  and operation status UI.
- `ports/`: save adapter and operation contracts used by the host app.

Rules:

- `oq_editor` must not import app services, HTTP clients, or app localization.
- Widgets read state and dispatch controller intents only.
- Controller methods own package mutations and selection repair.
- Operation code must not manipulate routes or dialogs directly.
- State models must be immutable and typed.

## Editor UX

- Replace the nested step flow with a single `OqEditorShell`.
- Desktop/tablet: left outline tree, center editor panel, right preview/summary
  panel.
- Mobile: outline opens from a drawer and editor/preview switch through tabs.
- Tree nodes:
  - package
  - round
  - theme
  - question
- Selection model:
  - `EditorNodeId.package()`
  - `EditorNodeId.round(roundIndex)`
  - `EditorNodeId.theme(roundIndex, themeIndex)`
  - `EditorNodeId.question(roundIndex, themeIndex, questionIndex)`
- Add/update/delete/reorder operations must preserve or repair selection
  deterministically.

## Operation Pipeline

- Replace separate encoding/upload dialogs and scattered streams with one
  serialized operation runner.
- Operation state:
  - `idle`
  - `running(phase, progress, message)`
  - `completed(message)`
  - `failed(error, stackTrace)`
- Phases:
  - `importPicking`
  - `importParsing`
  - `encoding`
  - `exporting`
  - `creatingPackage`
  - `uploadingMedia`
  - `finalizing`
- Only one import/export/save operation may run at a time.
- Toolbar actions are disabled while an operation is running.
- Errors must surface as terminal failure states and visible UI feedback.
- Save flow: normalize order, validate, encode media, create package, upload
  media, update saved package ID.
- Export flow: normalize order, validate, encode media, write compatible `.oq`.
- Import flow: pick `.oq`/`.siq`, parse, validate, replace package/media store,
  select package node.

## Public Interfaces

- Keep `OqEditorScreen(controller: ...)` as the public entrypoint.
- Replace `onSave` and `onSaveProgressStream` with a save adapter:
  - `PackageEditorSaveRequest`
  - `PackageEditorOperationEvent`
  - `OqPackageSaveAdapter`
- Keep existing package DTOs: `OqPackage`, `PackageRound`, `PackageTheme`,
  `PackageQuestionUnion`.
- Keep `.oq` archive compatibility: `content.json`, optional
  `encoded_files.json`, `files/{md5}`.
- Keep `OqEditorTranslations` as the localization boundary.

## Test Plan

- Unit tests for selection, CRUD, reorder, order normalization, validation, and
  operation state transitions.
- Import/export tests for `.oq` compatibility, encoded cache restoration,
  corrupt archive failure, and hash mismatch failure.
- Save pipeline tests for success, encoding failure, upload failure, and no-media
  package save.
- Widget tests for desktop split view and mobile outline access.

Verification commands:

```bash
cd client/packages/oq_editor && dart run build_runner build --delete-conflicting-outputs
cd client/packages/oq_editor && flutter test
cd client/apps/client && flutter analyze
```
