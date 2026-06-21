import 'dart:async';

import 'package:openquester/common_imports.dart';

@Singleton(order: 6)
class PackageController {
  Future<OqPackage>? _lastPackageCache;

  Future<OqPackage> getPackage(int id) async {
    if ((await _lastPackageCache)?.id == id) return _lastPackageCache!;
    final result = Api.I.api.packages.getV1PackagesId(id: id);
    _lastPackageCache = result;
    return result;
  }
}
