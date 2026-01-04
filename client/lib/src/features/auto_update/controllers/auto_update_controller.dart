import 'package:flutter/foundation.dart';
import 'package:openquester/common_imports.dart';
import 'package:universal_io/io.dart';
import 'package:url_launcher/url_launcher.dart';

@singleton
class AutoUpdateController {
  String get getCurrentVersion {
    final info = getIt<PackageInfoController>().packageInfo;
    var buildNumber = info.buildNumber.trim();
    if (buildNumber.isEmpty) buildNumber = '0';
    return _formatVersion(info.version, buildNumber);
  }

  String _formatVersion(String? version, String? buildNumber) =>
      [version, buildNumber].nonNulls.join('+');

  Future<String?> getLatestVersion() async {
    final url = Env.clientAppUrl.replace(path: '/version.json');
    final versionJsonResponse = await getIt<DioController>().client
        .getUri<Map<String, dynamic>>(url);
    final versionJson = versionJsonResponse.data;
    final version = versionJson?['version']?.toString();
    final buildNumber = versionJson?['build_number']?.toString();
    return _formatVersion(version, buildNumber);
  }

  Future<Uri> getBinaryUrl(String? version) async {
    final clearVersion = version?.split('+').firstOrNull;
    final url = Uri.https(
      'github.com',
      [
        '/OpenQuester/OpenQuester/releases/download',
        'v$clearVersion',
        _getPlatformUpdateFile(clearVersion),
      ].join('/'),
    );
    return url;
  }

  String _getPlatformUpdateFile(String? version) {
    if (kIsWeb) return '';
    if (Platform.isWindows) return 'OpenQuester-x86_64-$version-Installer.exe';
    if (Platform.isAndroid) return 'app-release.apk';
    if (Platform.isLinux) {
      // Check if running as AppImage (Flatpak updates are handled differently)
      const buildType = String.fromEnvironment('BUILD_TYPE', defaultValue: 'appimage');
      if (buildType == 'flatpak') {
        // Flatpak updates through Flathub or system package manager
        return '';
      }
      return 'OpenQuester-x86_64.AppImage';
    }
    return '';
  }

  bool get showUpdateBtn {
    if (kIsWeb) return false;
    if (Platform.isLinux) {
      // Don't show update button for Flatpak builds
      const buildType = String.fromEnvironment('BUILD_TYPE', defaultValue: 'appimage');
      if (buildType == 'flatpak') return false;
    }
    return Platform.isWindows || Platform.isAndroid || Platform.isLinux;
  }

  Future<void> openInstallFile() async {
    final uri = await getBinaryUrl(await getLatestVersion());
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}
