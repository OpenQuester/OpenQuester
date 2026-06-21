import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class GamesListScreen extends StatelessWidget {
  const GamesListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constrains) {
        return PaginatedListWidget<GamesListController, GameListItem>(
          itemBuilder: (context, item, index) => GameListItemWidget(
            item: item,
            onTap: () => GamePreviewRoute(
              item: (item, constrains.biggest),
              gameId: item.id,
            ).push<void>(context),
          ),
        );
      },
    );
  }
}
