import 'package:flutter/material.dart';
import 'package:infinite_scroll_pagination/infinite_scroll_pagination.dart';
import 'package:openquester/common_imports.dart';

class PaginatedListSliverWidget<
  _Controller extends ListControllerBase<ListItem>,
  ListItem
>
    extends StatelessWidget {
  const PaginatedListSliverWidget({required this.itemBuilder, super.key});

  final Widget Function(BuildContext, ListItem, int) itemBuilder;

  @override
  Widget build(BuildContext context) {
    return PagingListener(
      controller: getIt<_Controller>().pagingController,
      builder: (context, state, fetchNextPage) =>
          PagedSliverList<int, ListItem>(
            state: state,
            fetchNextPage: fetchNextPage,
            builderDelegate: PagedChildBuilderDelegate<ListItem>(
              animateTransitions: true,
              itemBuilder: itemBuilder,
            ),
          ),
    );
  }
}
