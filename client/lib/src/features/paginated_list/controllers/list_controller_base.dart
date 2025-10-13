import 'package:flutter/foundation.dart';
import 'package:infinite_scroll_pagination/infinite_scroll_pagination.dart';
import 'package:openquester/src/core/logger.dart';

abstract class ListControllerBase<I extends dynamic> extends ChangeNotifier {
  int? _nextPageKey = 0;

  @protected
  Future<ListResponse<I>> getPage(ListRequest request);

  Future<void> init() async {}

  Future<List<I>> _fetchPage(int pageKey) async {
    try {
      final listRequest = ListRequest(offset: pageKey);
      final newItems = await getPage(listRequest);

      _setNextPage(newItems, listRequest);

      return newItems.list;
    } catch (e, s) {
      logger.e(e, stackTrace: s);
      rethrow;
    }
  }

  void _setNextPage(ListResponse<dynamic> newItems, ListRequest listRequest) {
    // If no items were returned, we are at the end of the list
    if (newItems.list.isEmpty) {
      _nextPageKey = null;
      return;
    }

    final currentLenght = pagingController.items?.length ?? 0;
    if (newItems.metadata.total > currentLenght + newItems.list.length) {
      _nextPageKey = listRequest.offset + 1;
    } else {
      _nextPageKey = null;
    }
  }

  @protected
  Future<void> deleteItem(dynamic id) async {
    final state = pagingController.value;
    final pages = state.pages;
    if (pages == null) return;

    // Make a deep copy of each page
    final newPages = pages.map(List<I>.from).toList();

    // Find & remove the item from whichever page it lives in
    for (final page in newPages) {
      final idx = page.indexWhere((e) => e.id == id);
      if (idx >= 0) {
        page.removeAt(idx);
        break;
      }
    }

    // Emit a new state with updated pages
    pagingController.value = state.copyWith(pages: newPages);
  }

  @protected
  Future<void> addFirstItem(I item) async {
    final state = pagingController.value;
    final pages = state.pages;
    if (pages == null || pages.isEmpty) return;

    // Copy the first page and insert at its front
    final firstPage = List<I>.from(pages.first)..insert(0, item);

    // Rebuild pages array with the new first page
    final newPages = [firstPage, ...pages.sublist(1)];

    pagingController.value = state.copyWith(pages: newPages);
  }

  @protected
  Future<void> updateItem(I updated) async {
    final state = pagingController.value;
    final pages = state.pages;
    if (pages == null) return;

    // Deep-copy pages so we can mutate
    final newPages = pages.map(List<I>.from).toList();

    // Find & replace the item
    for (final page in newPages) {
      final idx = page.indexWhere((e) => e.id == updated.id);
      if (idx >= 0) {
        page[idx] = updated;
        break;
      }
    }

    pagingController.value = state.copyWith(pages: newPages);
  }

  @override
  Future<void> dispose() async {
    super.dispose();
    pagingController.dispose();
  }

  late final PagingController<int, I> pagingController = PagingController(
    getNextPageKey: _getNextPageKey,
    fetchPage: _fetchPage,
  );

  int? _getNextPageKey(PagingState<int, I> state) {
    if (state.status == PagingStatus.loadingFirstPage) {
      return _nextPageKey = 0;
    }
    return _nextPageKey;
  }
}

class ListRequest {
  const ListRequest({required this.offset, this.limit = 20, this.query});
  final int limit;
  final int offset;
  final String? query;
}

class ListResponse<I> {
  const ListResponse({required this.list, required this.metadata});
  final List<I> list;
  final ListResponseMeta metadata;
}

class ListResponseMeta {
  const ListResponseMeta({required this.total});
  final int total;
}
