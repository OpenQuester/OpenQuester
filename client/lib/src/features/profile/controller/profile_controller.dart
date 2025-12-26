import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';
import 'package:openquester/openquester.dart';

@Singleton(order: 2)
class ProfileController {
  final user = ValueNotifier<ResponseUser?>(null);

  static ResponseUser? getUser() => getIt<ProfileController>().user.value;

  @PostConstruct(preResolve: true)
  Future<void> load() async {
    try {
      user.value = await getIt.get<Api>().api.users.getV1Me();
    } catch (e) {
      logger.t(e);
    }
  }

  Future<void> changeAvatar() async {
    final fileResult = await FileService.pickFile(
      filePickConf: const PickerSettings(type: FileType.image),
    );
    final file = fileResult?.files.firstOrNull;
    if (file == null) return;
    // TODO: Add image resize

    final filename = await getIt<S3UploadController>().getLinkAndUpload(
      await file.xFile.readAsBytes(),
    );
    await Api.I.api.users.patchV1Me(
      body: InputUpdateUser(
        username: null,
        email: null,
        birthday: null,
        avatar: filename,
      ),
    );
    await load();
  }

  static bool hasPermission(PermissionName permissionName) =>
      ProfileController.getUser()?.hasPermission(permissionName) ?? false;
}
