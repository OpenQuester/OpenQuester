import 'package:flutter/material.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_compress/oq_compress.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/models/oq_editor_translations.dart';
import 'package:oq_editor/models/package_encoding_exceptions.dart';
import 'package:oq_editor/view/dialogs/encoding_warning_dialog.dart';

class PackageEncodingHelper {
  static Future<bool> checkEncodingSupport(
    BuildContext context, {
    required bool hasMediaFiles,
    required double totalSizeMB,
    required OqEditorTranslations translations,
  }) async {
    if (!hasMediaFiles) return true;

    final isEncodingSupported = await OqFileEncoder.isSupported();
    if (isEncodingSupported) return true;
    if (!context.mounted) return false;

    final action = await showDialog<EncodingWarningAction>(
      context: context,
      builder: (context) => EncodingWarningDialog(
        translations: translations,
        totalSizeMB: totalSizeMB,
      ),
    );

    return action == EncodingWarningAction.upload;
  }

  static Future<OqPackage> executePackageUpload(
    BuildContext context, {
    required OqEditorController controller,
    required Future<OqPackage> Function() uploadFunction,
    required OqEditorTranslations translations,
  }) async {
    final shouldProceed = await checkEncodingSupport(
      context,
      hasMediaFiles: controller.pendingMediaFiles.isNotEmpty,
      totalSizeMB: controller.totalMediaFilesSizeMB,
      translations: translations,
    );

    if (!shouldProceed) {
      throw const UploadCancelledException();
    }

    return uploadFunction();
  }
}
