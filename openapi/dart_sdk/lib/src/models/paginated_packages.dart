// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'package_list_item.dart';
import 'page_info.dart';

part 'paginated_packages.freezed.dart';
part 'paginated_packages.g.dart';

@Freezed()
abstract class PaginatedPackages with _$PaginatedPackages {
  const factory PaginatedPackages({
    required List<PackageListItem> data,
    required PageInfo pageInfo,
  }) = _PaginatedPackages;
  
  factory PaginatedPackages.fromJson(Map<String, Object?> json) => _$PaginatedPackagesFromJson(json);
}
