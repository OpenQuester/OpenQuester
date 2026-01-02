import 'package:openquester/common_imports.dart';

/// Filter options for package search
class PackageSearchFilters {
  const PackageSearchFilters({
    this.title,
    this.description,
    this.language,
    this.authorId,
    this.tags,
    this.ageRestriction,
    this.minRounds,
    this.maxRounds,
    this.minQuestions,
    this.maxQuestions,
    this.sortBy = PackagesSortBy.createdAt,
    this.order = OrderDirection.desc,
  });

  final String? title;
  final String? description;
  final String? language;
  final int? authorId;
  final List<String>? tags;
  final AgeRestriction? ageRestriction;
  final int? minRounds;
  final int? maxRounds;
  final int? minQuestions;
  final int? maxQuestions;
  final PackagesSortBy sortBy;
  final OrderDirection order;

  /// Creates a copy with modified fields
  PackageSearchFilters copyWith({
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
    PackagesSortBy? sortBy,
    OrderDirection? order,
  }) {
    return PackageSearchFilters(
      title: title ?? this.title,
      description: description ?? this.description,
      language: language ?? this.language,
      authorId: authorId ?? this.authorId,
      tags: tags ?? this.tags,
      ageRestriction: ageRestriction ?? this.ageRestriction,
      minRounds: minRounds ?? this.minRounds,
      maxRounds: maxRounds ?? this.maxRounds,
      minQuestions: minQuestions ?? this.minQuestions,
      maxQuestions: maxQuestions ?? this.maxQuestions,
      sortBy: sortBy ?? this.sortBy,
      order: order ?? this.order,
    );
  }

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
