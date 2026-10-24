# Package media editor

Baseline: PR #446, head `b87d8f45f62c81350876000537b58294a0123d21` on 2026-10-18.

## Product decisions

The React package editor opens an editor when an author selects or drops media.
Save media returns an accepted attachment to the still-unsaved question form;
Save question commits the question and its media together as one package Undo
step. Cancelling the question discards its staged media. The package logo uses
the same staging rules in Package details.

Editing existing attachments is included, including media from imported SIGame
packages and drafts opened from published packages. Importing an entire archive
does not interrupt the author with an editor for every file. A visible Edit
action opens the selected attachment on demand. Shared source hashes are never
globally replaced: the edit affects only the chosen occurrence.

This release targets full editing in desktop Chrome/Edge, with responsive
layouts down to 375 px and explicit capability limitations elsewhere. Keep the
existing themes, Radix focus management, and English/Ukrainian/Russian copy.
Small dependencies are acceptable if necessary and themeable, but the installed
Mediabunny and image encoders already cover processing.

## Interface and interaction

Media editing replaces the visible contents of the owning form's dialog while
retaining its fields and scroll position. Pause the owning form's audio/video
attachments and question previews when entering the media editor; returning to
the form keeps them paused until the author explicitly plays them again.
Use a large preview, labeled tools, contextual settings, and a persistent footer. On narrow screens, settings move
below the preview. Keep the filename, destination, dimensions/duration and
processing state visible; codec names are not primary UI.

Multiple imports use one queue with File N of M, Save and next, Skip file and an
explicit Add remaining unchanged action. Read and process one file at a time;
retain later browser File handles without decoding them. Restore focus to the
entry point on return. Saving an unchanged source preserves its bytes.

Dirty media edits require discard confirmation. Processing can be cancelled;
failure keeps parameters available for retry. Parent forms offer an inline media
Undo. Cancel and its discard confirmation share the persistent footer; confirmation
focuses Keep editing. Image editing has command history, with one step per gesture.
Compact arrow buttons expose Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z. Global
package Undo/Redo retains previous media in memory only, within the existing
100-step package history. Keyboard actions are scoped to the active editor;
text inputs retain native Undo. Ctrl/Cmd+Enter must not submit both editors.

### Images

Include rectangular cropping, a rotation input in degrees with left/right buttons
subtracting/adding 90 degrees, whole-image and rectangular-area blur,
pen, arrow, rectangle and text tools. Annotations can be selected, moved and
deleted; expose color, stroke width, text size and blur strength. Provide explicit
Fit to preview, zoom out/in, a percentage button returning to 100%, and
hold-to-compare-original controls. Zoom affects only the preview and supports
scrolling the enlarged canvas. The image settings panel is 288 px on desktop;
rotation buttons flank the degree input on one row. Arbitrary positive/negative
angles rotate the full cropped composition into a fitted bounding rectangle;
new corners stay transparent. Preview, pointer mapping, selection outlines and
export share that geometry. Respect source orientation and alpha.
Blur the image beneath annotations; rotate the complete composition.
Crop coordinates are normalized against the oriented, unrotated source; drawing
coordinates remain unchanged. Apply a dragged rectangle or percentage fields as
one Undo step, with Reset crop available. The final crop is fitted to output
limits without upscaling. Rotation and annotations remain aligned after cropping.

The numbered toolbar uses 1 Select/move, 2 Crop, 3 Pen, 4 Arrow, 5 Rectangle,
6 Text, 7 Blur area. Show small shortcut digits on the buttons. Shortcuts are
local to the active media editor, including its header/footer, and leave text,
numeric/select inputs, composition and modified browser shortcuts alone.
After placing a new annotation, return to Select/move and select that annotation.
Show its selection outline only after drawing finishes. Hide drawing properties
when Select/move has no selection; blur exposes strength rather than color.

Quality presets are Small (AVIF 25 / WebP .55), Balanced (50 / .8), and High
(75 / .95); transformed images default to Balanced. Preserve the existing
1280x720 fit limit without upscaling and show actual output dimensions.
Geometry updates immediately. Debounce encoded previews by 250 ms and reject
stale results. Keep at most one active encode and the latest pending request.
Save uses the latest reviewed bytes. Animated images and SVG are unchanged-only;
never silently flatten them. Blur is explicitly unavailable without canvas
filter support.

The upload optimizer uses the same animated-image detection as the editor
(GIF, APNG, animated WebP and AVIF sequences). Source bytes remain unchanged.
Attachment duration fields retain fractional/comma input while typing. Removing
the first question image clears a point-answer target tied to that image.
Replacing an attachment keeps its Edit button mounted so focus can return.

### Video and audio

Keep one start-to-end interval. Audio has one compact waveform; video has one
thumbnail timeline beneath its preview. Click or drag directly on either timeline
to seek across the source, including excluded regions. Display the current time
and source duration below it, with a single Play/Pause icon button. Playback
resumes at the cursor within the retained interval, restarts at the beginning
when outside it, and stops at its end. Space toggles playback; timeline arrow keys
seek by .1 seconds (Shift: 1 second), Page Up/Down by 10 seconds, and Home/End
go to the source boundaries. Preserve native text and button keyboard behavior.

Directional buttons on either side of Play/Pause set the start or end at the
playhead, discarding the left or right portion. Disable a cut that would create
an empty/reversed interval or leave the boundary unchanged. Each cut is one Undo
step. Keep editable minutes:seconds fields for precision and a resulting duration;
there are no separate start/end or playback sliders. Highlight the retained
interval and shade excluded regions. On desktop the preview
and timeline sit beside the settings, fitting a 1864x884 viewport without vertical
editor scrolling. On narrow screens settings follow the preview without overlap.
Video has a thumbnail strip and a translucent sound toggle at the bottom-right
of its preview. Speaker/crossed-speaker icons show whether the saved result keeps
audio. The toggle supports Undo and accessible pressed states; already-silent
video explains that state and disables the toggle.
Audio has a streamed waveform and numeric fade-in/out durations without separate
checkboxes: 0 disables a fade, a positive duration enables it. Show the same
linear gain envelope on the waveform while either fade is enabled. Either fade
can occupy the entire fragment. Increasing one reduces the other to keep their
sum within the fragment; shortening the trim scales both fades proportionally.
Show durations in seconds without floating-point artifacts.
Preview and export use the same envelope and respect seeking and trim changes.
Do not encode the entire clip on each seek or trim change.

## Implementation and storage contract

Use existing editor state, immutable package operations and transactional
IndexedDB saves. Source acquisition, parameters and results remain local to the
owning form until its Save. Sources fetched from storage are downloaded only
when editing; inspect bytes because archive/published filenames may be hashes.
Validate size, hash and decodability. Download or codec failures never change
the attachment. Distinguish intentional audio removal from decoding failure;
silent/muted video must not require an audio encoder.

Keep a discriminated image/audio/video edit state, native Canvas composition,
the existing image worker and Mediabunny conversion. Guard callbacks against
closed forms, superseded requests and changed destinations. A processed file
gets a fresh MD5 and an extension matching its encoding. Preserve order,
displayTime, placement and waitForFinish. Rotating or cropping the first question image of
a picture-point answer clears its target and requires reselection before Publish.
Picture-point hit coordinates use the displayed image bounds. Its wrapper must
shrink to the image even inside flex layouts; the target is a CSS square with
rounded borders, so its radius stays circular on every image aspect ratio.

MediaFile adds local-only preserveEncoding and displayName metadata. Publishing
skips optimization for explicitly accepted media; HTTP and archive contracts
remain unchanged. IndexedDB retains the flag across reloads. Standard .oq
archives contain flattened media bytes, not edit recipes or original versions.

After successful draft persistence, collect media unreferenced by every saved
draft. Retain current/past/future media only while the open session needs it.
Release object URLs, workers, decoded images/audio samples and abandoned staged
buffers. Downloaded old bytes remain in memory for Undo even if publishing later
removes the old storage object. Shared originals used by other attachments,
drafts, packages or active game snapshots remain legitimate referenced media;
preserve existing server cleanup protections.

No new endpoints, server transcoding, Flutter implementation, permanent edit
history, archive format change, multitrack editing or middle-section removal
are included. Rectangular cropping and arbitrary rotation were added following
the creator's annotation feedback on 2026-10-19.

## Execution and acceptance

Implement the shared surface and staged import/edit queue first, then image
tools, audiovisual tools, persistence/cleanup, localization and verification.
Reuse web/src/features/package-editor and features/upload/optimize; avoid an editor
framework or architecture-wide refactor.

Required cases:

- Import/edit/save question/reload retains only the accepted references.
- Cancel media, cancel processing and discard parent preserve package state.
- Undo/Redo restores bytes even after IndexedDB collection.
- Shared hashes remain intact in other attachment occurrences.
- Rapid quality changes cannot save stale bytes.
- Image orientation, rotation, blur, drawing and alpha survive export/re-import.
- Encoded trim duration matches the selection; muted video has no audio track.
- Timeline seeking, resumed playback, cut buttons and Undo/Redo work with mouse,
  touch and keyboard; cuts never produce an empty interval.
- Picture targets are circular and aligned to clicks on landscape, portrait and
  square images at desktop, tablet and phone widths.
- Fade samples and preview agree after seeking and trimming.
- Unsupported codecs, download failure, corruption and full local storage are
  recoverable and do not silently restore an original on Save.
- Publish/resume sends accepted bytes without another encode.
- SIGame warnings, timing, choice images and point validation remain intact.
- Ten mixed files can be added without repeated picker visits or lost form text.

Run web typecheck, lint, unit/component tests, native browser media/storage
checks, and focused package-editor/upload E2E. Inspect actual encoded outputs.
Capture image/video/audio/batch/failure states at desktop, tablet and phone
widths. Report tested browser/device combinations separately from responsive
emulation and disclose unrun checks. Update web/AGENTS.md alongside this spec.
