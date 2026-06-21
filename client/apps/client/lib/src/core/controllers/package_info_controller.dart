import 'package:openquester/openquester.dart';
import 'package:package_info_plus/package_info_plus.dart';

@singleton
class PackageInfoController {
  late final PackageInfo packageInfo;

  @PostConstruct(preResolve: true)
  Future<void> init() async {
    packageInfo = await PackageInfo.fromPlatform();
  }
}
