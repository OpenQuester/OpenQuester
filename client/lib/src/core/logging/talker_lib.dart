import 'package:openquester/common_imports.dart';
import 'package:talker_flutter/talker_flutter.dart';

@Singleton(order: -1)
class TalkerLogger implements BaseLogger {
  @PostConstruct(preResolve: true)
  Future<void> init() async {
    talker = TalkerFlutter.init();
    talker.settings.registerKeys(
      AppTalkerKeys.values.map((e) => e.name).toList(),
    );
  }

  late final Talker talker;

  @override
  void i(
    dynamic message, {
    DateTime? time,
    Object? error,
    StackTrace? stackTrace,
  }) {
    talker.info(message, error, stackTrace);
  }

  @override
  void w(
    dynamic message, {
    DateTime? time,
    Object? error,
    StackTrace? stackTrace,
  }) {
    talker.warning(message, error, stackTrace);
  }

  @override
  void e(
    dynamic message, {
    DateTime? time,
    Object? error,
    StackTrace? stackTrace,
  }) {
    talker.error(message, error, stackTrace);
  }

  @override
  void t(
    dynamic message, {
    DateTime? time,
    Object? error,
    StackTrace? stackTrace,
  }) {
    talker.verbose(message, error, stackTrace);
  }

  @override
  void d(
    dynamic message, {
    DateTime? time,
    Object? error,
    StackTrace? stackTrace,
  }) {
    talker.debug(message, error, stackTrace);
  }
}

enum AppTalkerKeys {
  socketIoRequest,
  socketIoResponse,
}
