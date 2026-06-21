import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class PackagesListScreen extends StatelessWidget {
  const PackagesListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return PaginatedListWidget<PackagesListController, PackageListItem>(
      itemBuilder: (context, item, index) => PackageListItemWidget(item: item),
    );
  }
}
