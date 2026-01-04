import 'package:mason_logger/mason_logger.dart';

/// Interface for custom package handlers
/// Handlers can execute custom logic before or after standard build steps
abstract class PackageHandler {
  /// The name of the package this handler is for
  String get packageName;

  /// Execute custom logic for the package
  /// Returns true if successful, false otherwise
  Future<bool> execute(
    String packagePath, {
    required Logger logger,
    Progress? progress,
    bool verbose = false,
  });
}
