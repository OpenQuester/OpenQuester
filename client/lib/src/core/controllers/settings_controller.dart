import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

@singleton
class SettingsController extends ChangeNotifier {
  late AppSettings settings;

  @PostConstruct(preResolve: true)
  Future<void> init() async {
    settings = await getSettings();
    notifyListeners();
  }

  Future<AppSettings> getSettings() async {
    final storage = getIt<Storage>();
    final settingsJson = await storage.get(StorageKeys.appSettings);

    if (settingsJson != null) {
      return AppSettings.fromJson(settingsJson as Map<String, dynamic>);
    } else {
      return const AppSettings(
        themeSeed: AppThemeSeed.indigo,
        themeMode: ThemeMode.system,
      );
    }
  }

  void updateSettings(AppSettings newSettings) {
    settings = newSettings;
    notifyListeners();
    persistSettings();
  }

  Future<void> persistSettings() async {
    final storage = getIt<Storage>();
    await storage.put(StorageKeys.appSettings, jsonEncode(settings.toJson()));
  }
}
