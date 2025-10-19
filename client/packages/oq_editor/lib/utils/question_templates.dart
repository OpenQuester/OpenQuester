import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_editor/models/oq_editor_translations.dart';
import 'package:oq_editor/utils/media_type_detector.dart';
import 'package:path/path.dart' as path;

/// Question template types
enum QuestionTemplate {
  none,
  openingQuestion,
}

/// Utility class for applying question templates
class QuestionTemplates {
  QuestionTemplates._();

  /// Apply "File Import" template
  /// Allows selecting 1-2 media files (question + optional answer)
  /// Answer text is derived from first file's filename
  static Future<PackageQuestionUnion?> applyFileImportTemplate({
    required BuildContext context,
    required OqEditorController controller,
    required OqEditorTranslations translations,
  }) async {
    try {
      // Pick question file(s) - allow selecting 1 or 2 files
      final questionResult = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: MediaTypeDetector.allExtensions,
        dialogTitle: translations.selectQuestionFile,
        allowMultiple: true,
      );

      if (questionResult == null || questionResult.files.isEmpty) return null;

      final questionFile = questionResult.files.first;
      final questionType = MediaTypeDetector.detectType(questionFile.extension);

      if (questionType == null) {
        throw Exception('Unsupported file type: ${questionFile.extension}');
      }

      // Extract filename without extension for answer
      final fileNameWithoutExt = path.basenameWithoutExtension(
        questionFile.name,
      );

      // Determine if we need to ask for answer file or use second selected file
      var addAnswerFile = false;
      PlatformFile? answerFile;

      if (questionResult.files.length >= 2) {
        // Two files selected - use second as answer file
        addAnswerFile = true;
        answerFile = questionResult.files[1];
      } else {
        // Only one file selected - ask if user wants to add answer file
        if (!context.mounted) return null;

        addAnswerFile =
            await showDialog<bool>(
              context: context,
              builder: (context) => AlertDialog(
                title: Text(translations.selectAnswerFile),
                content: Text(
                  '${translations.templateOpeningQuestionDesc}\n\n'
                  '${translations.optional}',
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(context, false),
                    child: Text(translations.cancelButton),
                  ),
                  FilledButton(
                    onPressed: () => Navigator.pop(context, true),
                    child: Text(translations.addButton),
                  ),
                ],
              ),
            ) ??
            false;
      }

      // Create question media file
      final questionMediaRef = MediaFileReference(
        platformFile: questionFile,
      );
      final questionHash = await controller.registerMediaFile(questionMediaRef);

      final questionFiles = [
        PackageQuestionFile(
          id: null,
          order: 0,
          file: FileItem(
            id: null,
            md5: questionHash,
            type: questionType,
            link: null,
          ),
          displayTime: controller.lastUsedQuestionDisplayTime,
        ),
      ];

      List<PackageQuestionFile>? answerFiles;

      // Add answer file if needed
      if (addAnswerFile) {
        // If no answerFile from initial selection, pick one
        if (answerFile == null) {
          if (!context.mounted) return null;

          final answerResult = await FilePicker.platform.pickFiles(
            type: FileType.custom,
            allowedExtensions: MediaTypeDetector.allExtensions,
            dialogTitle: translations.selectAnswerFile,
          );

          if (answerResult != null && answerResult.files.isNotEmpty) {
            answerFile = answerResult.files.first;
          }
        }

        // Process answer file if available
        if (answerFile != null) {
          final answerType = MediaTypeDetector.detectType(answerFile.extension);

          if (answerType != null) {
            final answerMediaRef = MediaFileReference(
              platformFile: answerFile,
            );
            final answerHash = await controller.registerMediaFile(
              answerMediaRef,
            );

            answerFiles = [
              PackageQuestionFile(
                id: null,
                order: 0,
                file: FileItem(
                  id: null,
                  md5: answerHash,
                  type: answerType,
                  link: null,
                ),
                displayTime: controller.lastUsedAnswerDisplayTime,
              ),
            ];
          }
        }
      }

      // Create pre-filled question
      final question = PackageQuestionUnion.simple(
        id: null,
        order: 0,
        type: SimpleQuestionType.simple,
        price: controller.lastUsedPrice,
        text: translations.newQuestion,
        answerText: fileNameWithoutExt,
        answerHint: null,
        questionComment: null,
        answerDelay: controller.lastUsedAnswerDelay,
        questionFiles: questionFiles,
        answerFiles: answerFiles,
      );

      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(translations.templateApplied)),
        );
      }

      return question;
    } catch (e) {
      if (!context.mounted) return null;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${translations.errorAddingFile}: $e')),
      );
      return null;
    }
  }
}
