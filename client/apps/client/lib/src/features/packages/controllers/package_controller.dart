import 'dart:async';

import 'package:openquester/common_imports.dart';

@Singleton(order: 6)
class PackageController {
  int? _lastPackageId;
  Future<OqPackage>? _lastPackageFuture;
  OqPackage? _lastPackage;

  OqPackage? getCachedPackage(int id) {
    if (_lastPackageId != id) return null;
    return _lastPackage;
  }

  Future<OqPackage> getPackage(int id) {
    final cachedFuture = _lastPackageFuture;
    if (_lastPackageId == id && cachedFuture != null) {
      return cachedFuture;
    }

    final result = Api.I.api.packages.getV1PackagesId(id: id).then((package) {
      if (_lastPackageId == id) _lastPackage = package;
      return package;
    });
    _lastPackageId = id;
    _lastPackageFuture = result;
    _lastPackage = null;
    return result;
  }
}
