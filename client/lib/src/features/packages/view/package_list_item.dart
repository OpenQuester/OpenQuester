import 'dart:math';

import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class PackageListItemWidget extends StatelessWidget {
  const PackageListItemWidget({required this.item, super.key});

  static const int _maxVisibleTags = 5;

  final PackageListItem item;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: () => _showPackageDetails(context),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: 12.all,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 8,
            children: [
              // Title row
              Row(
                children: [
                  Expanded(
                    child: Text(
                      item.title,
                      style: context.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                      overflow: TextOverflow.ellipsis,
                      maxLines: 2,
                    ),
                  ),
                  if (item.logo != null)
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8),
                        color:
                            context.theme.colorScheme.surfaceContainerHighest,
                      ),
                      child: const Icon(Icons.image, size: 20),
                    ),
                ],
              ),
              // Description
              if (item.description?.isNotEmpty ?? false)
                Text(
                  item.description!,
                  style: context.textTheme.bodyMedium?.copyWith(
                    color: context.theme.colorScheme.onSurface.withValues(
                      alpha: 0.7,
                    ),
                  ),
                  overflow: TextOverflow.ellipsis,
                  maxLines: 2,
                ),
              // Metadata row
              Wrap(
                spacing: 12,
                runSpacing: 4,
                children: [
                  _buildMetadata(
                    context,
                    Icons.person_outline,
                    item.author.username,
                  ),
                  if (item.language != null)
                    _buildMetadata(
                      context,
                      Icons.language,
                      item.language!,
                    ),
                  _buildMetadata(
                    context,
                    Icons.calendar_today,
                    DateFormat.yMd().format(item.createdAt),
                  ),
                  if (item.ageRestriction != AgeRestriction.none)
                    _buildMetadata(
                      context,
                      Icons.shield_outlined,
                      item.ageRestriction.format(context)?.$1 ?? '',
                    ),
                ],
              ),
              // Tags
              if (item.tags?.isNotEmpty ?? false)
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: item.tags!
                      .sublist(0, min(_maxVisibleTags, item.tags!.length))
                      .map(
                        (tag) => Chip(
                          label: Text(
                            tag.tag,
                            style: context.textTheme.labelSmall,
                          ),
                          padding: EdgeInsets.zero,
                          visualDensity: VisualDensity.compact,
                        ),
                      )
                      .toList(),
                ),
            ],
          ),
        ),
      ),
    ).paddingSymmetric(horizontal: 6, vertical: 4);
  }

  Widget _buildMetadata(BuildContext context, IconData icon, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      spacing: 4,
      children: [
        Icon(
          icon,
          size: 14,
          color: context.theme.colorScheme.onSurface.withValues(alpha: 0.6),
        ),
        Text(
          text,
          style: context.textTheme.bodySmall?.copyWith(
            color: context.theme.colorScheme.onSurface.withValues(alpha: 0.7),
          ),
        ),
      ],
    );
  }

  Future<void> _showPackageDetails(BuildContext context) async {
    await PackageDetailRoute(packageId: item.id).push<void>(context);
  }
}
