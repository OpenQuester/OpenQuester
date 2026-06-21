import 'package:openquester/common_imports.dart';

@Singleton(order: 5)
class PackagesListController extends ListControllerBase<PackageListItem> {
  PackageSearchFilters _filters = const PackageSearchFilters();

  void updateFilters(PackageSearchFilters filters) {
    _filters = filters;
  }

  @override
  @PostConstruct(preResolve: true)
  Future<void> init() async {
    await super.init();
  }

  @override
  Future<ListResponse<PackageListItem>> getPage(ListRequest request) async {
    final list = await Api.I.api.packages.getV1Packages(
      limit: request.limit,
      offset: request.offset,
      order: _filters.order,
      sortBy: _filters.sortBy,
      title: _filters.title ?? request.query,
      description: _filters.description,
      language: _filters.language,
      authorId: _filters.authorId,
      tags: _filters.tags,
      ageRestriction: _filters.ageRestriction,
      minRounds: _filters.minRounds,
      maxRounds: _filters.maxRounds,
      minQuestions: _filters.minQuestions,
      maxQuestions: _filters.maxQuestions,
    );
    return ListResponse(
      list: list.data,
      metadata: ListResponseMeta(total: list.pageInfo.total),
    );
  }
}
