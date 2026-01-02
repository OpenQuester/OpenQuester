import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:openquester/common_imports.dart';

part 'package_search_filters.freezed.dart';

/// Filter options for package search
@freezed
abstract class PackageSearchFilters with _$PackageSearchFilters {
  const factory PackageSearchFilters({
    String? title,
    String? description,
    String? language,
    int? authorId,
    List<String>? tags,
    AgeRestriction? ageRestriction,
    int? minRounds,
    int? maxRounds,
    int? minQuestions,
    int? maxQuestions,
    @Default(PackagesSortBy.createdAt) PackagesSortBy sortBy,
    @Default(OrderDirection.desc) OrderDirection order,
  }) = _PackageSearchFilters;

  const PackageSearchFilters._();

  /// Checks if any filters are active
  bool get hasActiveFilters =>
      title != null ||
      description != null ||
      language != null ||
      authorId != null ||
      tags != null && tags!.isNotEmpty ||
      ageRestriction != null ||
      minRounds != null ||
      maxRounds != null ||
      minQuestions != null ||
      maxQuestions != null;

  /// Clears all filters
  PackageSearchFilters clearAll() {
    return PackageSearchFilters(
      sortBy: sortBy,
      order: order,
    );
  }
}
