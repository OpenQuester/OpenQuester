import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

@Singleton(order: 1)
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
    const defaultSettings = AppSettings();

    if (settingsJson != null) {
      // Attempt to parse the settings JSON
      // If it fails, log the error and return default settings
      try {
        return AppSettings.fromJson(
          jsonDecode(settingsJson.toString()) as Map<String, dynamic>,
        );
      } catch (e) {
        logger.e(e);
        return defaultSettings;
      }
    }
    // If no settings are found, return default settings
    return defaultSettings;
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
