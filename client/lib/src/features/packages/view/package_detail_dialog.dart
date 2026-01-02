import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

@RoutePage(deferredLoading: false)
class PackageDetailDialog extends StatefulWidget {
  const PackageDetailDialog({required this.packageId, super.key});

  final int packageId;

  @override
  State<PackageDetailDialog> createState() => _PackageDetailDialogState();
}

class _PackageDetailDialogState extends State<PackageDetailDialog> {
  late Future<OqPackage> _packageFuture;

  @override
  void initState() {
    super.initState();
    _packageFuture = _loadPackage();
  }

  Future<OqPackage> _loadPackage() async {
    return Api.I.api.packages.getV1PackagesId(id: widget.packageId);
  }

  @override
  Widget build(BuildContext context) {
    return AdaptiveDialog(
      builder: (context) => Card(
        elevation: 0,
        child: FutureBuilder<OqPackage>(
          future: _packageFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(
                child: CircularProgressIndicator(),
              ).paddingAll(48);
            }

            if (snapshot.hasError) {
              return Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  spacing: 16,
                  children: [
                    Icon(
                      Icons.error_outline,
                      size: 48,
                      color: context.theme.colorScheme.error,
                    ),
                    Text(
                      LocaleKeys.something_went_wrong.tr(),
                      style: context.textTheme.titleMedium,
                    ),
                  ],
                ).paddingAll(48),
              );
            }

            final package = snapshot.data!;
            return _buildContent(context, package);
          },
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, OqPackage package) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildHeader(context, package),
        Flexible(
          child: SingleChildScrollView(
            padding: 16.all,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: 20,
              children: [
                _buildBasicInfo(context, package),
                _buildRoundsSection(context, package),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildHeader(BuildContext context, OqPackage package) {
    return Container(
      padding: 16.all,
      decoration: BoxDecoration(
        color: context.theme.colorScheme.primaryContainer.withValues(
          alpha: 0.3,
        ),
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(12),
        ),
      ),
      child: Row(
        children: [
          if (package.logo != null)
            Container(
              width: 56,
              height: 56,
              margin: const EdgeInsets.only(right: 16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: context.theme.colorScheme.surfaceContainerHighest,
              ),
              child: const Icon(Icons.image, size: 32),
            ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 4,
              children: [
                Text(
                  package.title,
                  style: context.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  LocaleKeys.created_by.tr(args: [package.author.username]),
                  style: context.textTheme.bodyMedium?.copyWith(
                    color: context.theme.colorScheme.onSurface.withValues(
                      alpha: 0.7,
                    ),
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
      ),
    );
  }

  Widget _buildBasicInfo(BuildContext context, OqPackage package) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 12,
      children: [
        if (package.description?.isNotEmpty ?? false)
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 4,
            children: [
              Text(
                LocaleKeys.package_description.tr(),
                style: context.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                package.description!,
                style: context.textTheme.bodyMedium,
              ),
            ],
          ),
        Wrap(
          spacing: 16,
          runSpacing: 8,
          children: [
            _buildInfoChip(
              context,
              Icons.calendar_today,
              DateFormat.yMMMd().format(package.createdAt),
            ),
            if (package.language != null)
              _buildInfoChip(
                context,
                Icons.language,
                package.language!,
              ),
            if (package.ageRestriction != AgeRestriction.none)
              _buildInfoChip(
                context,
                Icons.shield_outlined,
                package.ageRestriction.format(context)?.$1 ?? '',
              ),
            _buildInfoChip(
              context,
              Icons.view_module_outlined,
              '${package.rounds.length} ${LocaleKeys.rounds.plural(package.rounds.length)}',
            ),
            _buildInfoChip(
              context,
              Icons.quiz_outlined,
              '${_getTotalQuestions(package)} questions',
            ),
          ],
        ),
        if (package.tags?.isNotEmpty ?? false)
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 8,
            children: [
              Text(
                LocaleKeys.package_tags.tr(),
                style: context.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: package.tags!
                    .map(
                      (tag) => Chip(
                        label: Text(tag),
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                      ),
                    )
                    .toList(),
              ),
            ],
          ),
      ],
    );
  }

  Widget _buildInfoChip(BuildContext context, IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: context.theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        spacing: 6,
        children: [
          Icon(icon, size: 16),
          Text(
            text,
            style: context.textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }

  Widget _buildRoundsSection(BuildContext context, OqPackage package) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 12,
      children: [
        Text(
          LocaleKeys.rounds.plural(package.rounds.length),
          style: context.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        ...package.rounds.map((round) => _buildRoundCard(context, round)),
      ],
    );
  }

  Widget _buildRoundCard(BuildContext context, PackageRound round) {
    final themeCount = round.themes.length;
    final questionCount = round.themes.fold<int>(
      0,
      (sum, theme) => sum + theme.questions.length,
    );

    return Card(
      elevation: 0,
      color: context.theme.colorScheme.surfaceContainer,
      child: ExpansionTile(
        title: Text(
          round.name,
          style: context.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        subtitle: Text(
          '$themeCount themes • $questionCount questions',
          style: context.textTheme.bodySmall,
        ),
        children: round.themes
            .map((theme) => _buildThemeItem(context, theme))
            .toList(),
      ),
    );
  }

  Widget _buildThemeItem(BuildContext context, PackageTheme theme) {
    return ListTile(
      dense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
      title: Text(
        theme.name,
        style: context.textTheme.bodyMedium?.copyWith(
          fontWeight: FontWeight.w500,
        ),
      ),
      subtitle: theme.description?.isNotEmpty ?? false
          ? Text(
              theme.description!,
              style: context.textTheme.bodySmall,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            )
          : null,
      trailing: Chip(
        label: Text(
          '${theme.questions.length}',
          style: context.textTheme.labelSmall,
        ),
        visualDensity: VisualDensity.compact,
      ),
    );
  }

  int _getTotalQuestions(OqPackage package) {
    return package.rounds.fold<int>(
      0,
      (sum, round) => sum +
          round.themes.fold<int>(
            0,
            (themeSum, theme) => themeSum + theme.questions.length,
          ),
    );
  }
}
