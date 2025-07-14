// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'package_entities_order.dart';
import 'package_round_type.dart';
import 'package_theme.dart';

part 'package_round.freezed.dart';
part 'package_round.g.dart';

/// Round structure for package
@Freezed()
abstract class PackageRound with _$PackageRound {
  const factory PackageRound({
    required int? id,
    required PackageEntitiesOrder order,

    /// Name of the round
    required String name,

    /// Description of the round
    required String? description,
    required PackageRoundType type,

    /// Themes in the round
    required List<PackageTheme> themes,
  }) = _PackageRound;
  
  factory PackageRound.fromJson(Map<String, Object?> json) => _$PackageRoundFromJson(json);
}
