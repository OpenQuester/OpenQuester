import 'package:flutter/material.dart';
import 'package:infinite_scroll_pagination/infinite_scroll_pagination.dart';
import 'package:openquester/common_imports.dart';

class PaginatedListWidget<
  _Controller extends ListControllerBase<ListItem>,
  ListItem
>
    extends StatelessWidget {
  const PaginatedListWidget({required this.itemBuilder, super.key});

  final Widget Function(BuildContext, ListItem, int) itemBuilder;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: RefreshIndicator.adaptive(
        onRefresh: () async => getIt<_Controller>().pagingController.refresh(),
        child: PagingListener(
          controller: getIt<_Controller>().pagingController,
          builder: (context, state, fetchNextPage) =>
              PagedListView<int, ListItem>(
                state: state,
                fetchNextPage: fetchNextPage,
                builderDelegate: PagedChildBuilderDelegate<ListItem>(
                  animateTransitions: true,
                  itemBuilder: itemBuilder,
                ),
              ),
        ),
      ),
    );
  }
}
