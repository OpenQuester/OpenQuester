import { mediaEditorStyles } from "./mediaEditorStyles";
import { useTranslation } from "react-i18next";
import type { MediaToolProps } from "./mediaEditorTypes";
import { mediaUrl } from "../packageMedia";
import { useImageEditor } from "./image-editor/useImageEditor";
import { ImageToolbar } from "./image-editor/ImageToolbar";
import { ImagePreview } from "./image-editor/ImagePreview";
import { ImageRotationControl } from "./image-editor/ImageRotationControl";
import { ImageCropControls } from "./image-editor/ImageCropControls";
import { ImageOutputControls } from "./image-editor/ImageOutputControls";
import { ImageAnnotationControls } from "./image-editor/ImageAnnotationControls";

export default function ImageEditor(props: MediaToolProps) {
  const { t } = useTranslation();
  const editor = useImageEditor(props);
  const { file } = props;
  const { supported } = editor;
  if (!supported)
    return (
      <div className={mediaEditorStyles.unsupportedImage}>
        <img
          src={mediaUrl(file)}
          alt={file.displayName ?? file.name}
          className="max-h-[50dvh] max-w-full object-contain"
        />
        <p role="status" className="text-warning">
          {t("mediaEditor.errors.unsupportedImage")}
        </p>
      </div>
    );

  return (
    <div className={mediaEditorStyles.editor} onKeyDown={editor.onKeyDown}>
      <ImageToolbar {...editor.toolbar} />
      <div className={mediaEditorStyles.imageWorkspace}>
        <ImagePreview {...editor.preview} />
        <aside className={mediaEditorStyles.imageSettings}>
          <ImageRotationControl {...editor.rotation} />
          {editor.tool === "crop" ? (
            <ImageCropControls {...editor.crop} />
          ) : (
            <>
              <ImageOutputControls {...editor.output} />
              <ImageAnnotationControls {...editor.annotations} />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
