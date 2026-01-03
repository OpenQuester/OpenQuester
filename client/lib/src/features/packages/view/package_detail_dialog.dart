import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';
import 'package:oq_editor/view/widgets/media_preview_widget.dart';

@RoutePage(deferredLoading: false)
class PackageDetailDialog extends WatchingWidget {
  const PackageDetailDialog({required this.packageId, super.key});

  final int packageId;

  @override
  Widget build(BuildContext context) {
    final packageAsync = watchFuture(
      future: () => Api.I.api.packages.getV1PackagesId(id: packageId),
      initialValue: null,
    );

    return AdaptiveDialog(
      builder: (context) => ConstrainedBox(
        constraints: const BoxConstraints(
          minWidth: 400,
          minHeight: 300,
        ),
        child: Card(
          elevation: 0,
          child: AnimatedCrossFade(
            duration: const Duration(milliseconds: 300),
            crossFadeState: packageAsync.hasData
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            firstChild: _buildLoadingState(context),
            secondChild: packageAsync.hasError
                ? _buildErrorState(context, packageAsync.error!)
                : packageAsync.hasData
                    ? _buildContent(context, packageAsync.data!)
                    : _buildLoadingState(context),
          ),
        ),
      ),
    );
  }

  Widget _buildLoadingState(BuildContext context) {
    return const Center(
      child: CircularProgressIndicator(),
    ).paddingAll(48);
  }

  Widget _buildErrorState(BuildContext context, Object error) {
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

  Widget _buildContent(BuildContext context, OqPackage package) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _PackageDetailHeader(package: package),
        Flexible(
          child: SingleChildScrollView(
            padding: 16.all,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: 20,
              children: [
                _PackageBasicInfo(package: package),
                _PackageRoundsSection(package: package),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _PackageDetailHeader extends StatelessWidget {
  const _PackageDetailHeader({required this.package});

  final OqPackage package;

  @override
  Widget build(BuildContext context) {
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
}

class _PackageBasicInfo extends StatelessWidget {
  const _PackageBasicInfo({required this.package});

  final OqPackage package;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 12,
      children: [
        if (!package.description.isEmptyOrNull)
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
            _PackageInfoChip(
              icon: Icons.calendar_today,
              text: DateFormat.yMMMd().format(package.createdAt),
            ),
            if (package.language != null)
              _PackageInfoChip(
                icon: Icons.language,
                text: package.language!,
              ),
            if (package.ageRestriction != AgeRestriction.none)
              _PackageInfoChip(
                icon: Icons.shield_outlined,
                text: package.ageRestriction.format(context)?.$1 ?? '',
              ),
            _PackageInfoChip(
              icon: Icons.view_module_outlined,
              text: '${package.rounds.length} ${LocaleKeys.rounds.plural(package.rounds.length)}',
            ),
            _PackageInfoChip(
              icon: Icons.quiz_outlined,
              text: '${_getTotalQuestions(package)} ${LocaleKeys.questions.plural(_getTotalQuestions(package))}',
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

class _PackageInfoChip extends StatelessWidget {
  const _PackageInfoChip({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
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
          Text(text, style: context.textTheme.bodyMedium),
        ],
      ),
    );
  }
}

class _PackageRoundsSection extends StatelessWidget {
  const _PackageRoundsSection({required this.package});

  final OqPackage package;

  @override
  Widget build(BuildContext context) {
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
        ...package.rounds.map((round) => _PackageRoundCard(round: round)),
      ],
    );
  }
}

class _PackageRoundCard extends StatelessWidget {
  const _PackageRoundCard({required this.round});

  final PackageRound round;

  @override
  Widget build(BuildContext context) {
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
          '${LocaleKeys.themes_count.tr(args: [themeCount.toString()])} • '
          '${LocaleKeys.questions.plural(questionCount)}',
          style: context.textTheme.bodySmall,
        ),
        children: round.themes
            .map((theme) => _PackageThemeItem(theme: theme))
            .toList(),
      ),
    );
  }
}

class _PackageThemeItem extends StatelessWidget {
  const _PackageThemeItem({required this.theme});

  final PackageTheme theme;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
      title: Text(
        theme.name,
        style: context.textTheme.bodyMedium?.copyWith(
          fontWeight: FontWeight.w500,
        ),
      ),
      subtitle: !theme.description.isEmptyOrNull
          ? Text(
              theme.description!,
              style: context.textTheme.bodySmall,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            )
          : null,
      trailing: ScoreText(
        score: theme.questions.length,
        textStyle: context.textTheme.labelSmall,
      ),
    );
  }
}
