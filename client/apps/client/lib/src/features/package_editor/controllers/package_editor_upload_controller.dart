import 'package:openquester/common_imports.dart';
import 'package:oq_editor/oq_editor.dart';

@singleton
class PackageEditorUploadController {
  static Stream<PackageEditorOperationEvent> savePackage(
    PackageEditorSaveRequest request,
  ) async* {
    await const ProfileDialog().showIfUnauthorized(
      AppRouter.I.navigatorKey.currentContext!,
    );

    final packageService = getIt<PackageService>();
    final packageInput = packageService.convertOqPackageToInput(
      request.package,
    );

    await for (final state in packageService.uploadPackage(
      packageInput: packageInput,
      mediaFilesByHash: request.mediaFilesByHash,
    )) {
      yield state.map(
        idle: (_) => const PackageEditorOperationEvent.running(
          phase: PackageEditorOperationPhase.creatingPackage,
          progress: 0,
        ),
        uploading: (state) => PackageEditorOperationEvent.running(
          phase: state.progress <= PackageService.uploadProgressStart
              ? PackageEditorOperationPhase.creatingPackage
              : PackageEditorOperationPhase.uploadingMedia,
          progress: state.progress,
          message: state.message,
        ),
        completed: (state) => PackageEditorOperationEvent.completed(
          package: request.package.copyWith(id: state.packageId),
          message: LocaleKeys.oq_editor_upload_complete.tr(),
        ),
        error: (state) {
          Error.throwWithStackTrace(
            state.error,
            state.stackTrace ?? StackTrace.current,
          );
        },
      );
    }
  }
}
