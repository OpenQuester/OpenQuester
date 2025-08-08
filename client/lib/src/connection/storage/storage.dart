import 'package:injectable/injectable.dart';
import 'package:shared_preferences/shared_preferences.dart';

@Singleton(order: 0)
class Storage {
  Future<SharedPreferences> get _prefs => SharedPreferences.getInstance();
  Future<void> put(StorageKeys key, String value) async {
    final prefs = await _prefs;
    await prefs.setString(key.name, value);
  }

  Future<Object?> get(StorageKeys key) async {
    final prefs = await _prefs;
    return prefs.get(key.name);
  }

  Future<void> rm(StorageKeys key) async {
    final prefs = await _prefs;
    await prefs.remove(key.name);
    return;
  }
}

enum StorageKeys {
  appSettings,
}
