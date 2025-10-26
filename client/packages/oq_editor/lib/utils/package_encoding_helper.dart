import 'dart:async';

import 'package:flutter/material.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_compress/oq_compress.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/models/oq_editor_translations.dart';
import 'package:oq_editor/models/package_encoding_exceptions.dart';
import 'package:oq_editor/models/package_upload_state.dart';
import 'package:oq_editor/view/dialogs/encoding_progress_dialog.dart';
import 'package:oq_editor/view/dialogs/encoding_warning_dialog.dart';
import 'package:oq_editor/view/dialogs/saving_progress_dialog.dart';

/// Helper for handling package encoding before upload
/// Encapsulates encoding warning checks and progress dialog management
/// Can be used by both editor and upload workflows
class PackageEncodingHelper {
  /// Check if encoding is needed and supported, show warning if needed
  /// Returns true if upload should proceed, false if cancelled
  /// Shows encoding warning dialog if encoding is not supported
  static Future<bool> checkEncodingSupport(
    BuildContext context, {
    required bool hasMediaFiles,
    required double totalSizeMB,
    required OqEditorTranslations translations,
  }) async {
    if (!hasMediaFiles) return true;

    final isEncodingSupported = await OqFileEncoder.isSupported();

    if (!isEncodingSupported) {
      if (!context.mounted) return false;

      // Show warning dialog for unsupported encoding
      final action = await showDialog<EncodingWarningAction>(
        context: context,
        builder: (context) => EncodingWarningDialog(
          translations: translations,
          totalSizeMB: totalSizeMB,
        ),
      );

      if (!context.mounted) return false;

      switch (action) {
        case EncodingWarningAction.export:
          // User chose to export instead - this is handled by caller
          return false;
        case EncodingWarningAction.upload:
          // Continue with upload
          return true;
        case null:
          // User cancelled
          return false;
      }
    }

    return true;
  }

  /// Show encoding progress dialog if needed
  /// Returns a function to close the dialog
  static VoidCallback? showEncodingProgressDialog(
    BuildContext context, {
    required bool hasMediaFiles,
    required Stream<double> encodingProgressStream,
    required OqEditorTranslations translations,
    required String title,
  }) {
    if (!hasMediaFiles || !context.mounted) return null;

    unawaited(
      showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (_) => EncodingProgressDialog(
          progressStream: encodingProgressStream,
          translations: translations,
          title: title,
        ),
      ),
    );

    return () {
      if (context.mounted) {
        Navigator.of(context).pop(); // Close encoding progress dialog
      }
    };
  }

  /// Show upload progress dialog
  /// Returns a function to close the dialog
  static VoidCallback showUploadProgressDialog(
    BuildContext context, {
    required Stream<PackageUploadState>? progressStream,
    required OqEditorTranslations translations,
  }) {
    if (!context.mounted) return () {};

    unawaited(
      showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (_) => SavingProgressDialog(
          progressStream: progressStream,
          translations: translations,
        ),
      ),
    );

    return () {
      if (context.mounted) {
        Navigator.of(context).pop(); // Close upload progress dialog
      }
    };
  }

  /// Execute package upload with encoding and progress handling
  /// Manages all dialogs and error handling
  /// Returns the saved package or throws an error
  static Future<OqPackage> executePackageUpload(
    BuildContext context, {
    required OqEditorController controller,
    required Future<OqPackage> Function() uploadFunction,
    required OqEditorTranslations translations,
  }) async {
    if (!context.mounted) throw StateError('Context not mounted');

    // Check encoding support
    final hasMediaFiles = controller.pendingMediaFiles.isNotEmpty;
    final shouldProceed = await checkEncodingSupport(
      context,
      hasMediaFiles: hasMediaFiles,
      totalSizeMB: controller.totalMediaFilesSizeMB,
      translations: translations,
    );

    if (!shouldProceed) {
      throw const UploadCancelledException();
    }

    VoidCallback? closeEncodingDialog;

    try {
      // Show encoding progress dialog if there are media files to encode
      closeEncodingDialog = showEncodingProgressDialog(
        context,
        hasMediaFiles: hasMediaFiles,
        encodingProgressStream: controller.encodingProgressStream,
        translations: translations,
        title: translations.encodingForUpload,
      );

      // Start the upload process (this will create the encoding stream if needed)
      final future = uploadFunction();

      // Wait a moment for encoding stream to be created if needed
      if (hasMediaFiles) {
        await Future<void>.delayed(const Duration(milliseconds: 100));
      }

      // Show upload progress dialog after encoding is done or if no encoding needed
      final closeUploadDialog = showUploadProgressDialog(
        context,
        progressStream: controller.onSaveProgressStream,
        translations: translations,
      );

      final result = await future;

      // Close dialogs
      closeUploadDialog();
      closeEncodingDialog?.call();

      return result;
    } catch (error) {
      // Clean up dialogs on error
      closeEncodingDialog?.call();
      if (context.mounted) {
        Navigator.of(context).pop(); // Close upload dialog if open
      }
      rethrow;
    }
  }
}
