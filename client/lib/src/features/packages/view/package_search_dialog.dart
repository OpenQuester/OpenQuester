import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:openquester/openquester.dart';

@RoutePage(deferredLoading: false)
class PackageSearchDialog extends StatefulWidget {
  const PackageSearchDialog({super.key});

  @override
  State<PackageSearchDialog> createState() => _PackageSearchDialogState();
}

class _PackageSearchDialogState extends State<PackageSearchDialog> {
  static const double _filtersPanelExpandedHeight = 540;

  final PackagesListController _controller = getIt<PackagesListController>();
  final _searchFieldKey = GlobalKey<FormFieldState<String>>();
  final _minRoundsFieldKey = GlobalKey<FormFieldState<String>>();
  final _maxRoundsFieldKey = GlobalKey<FormFieldState<String>>();
  final _minQuestionsFieldKey = GlobalKey<FormFieldState<String>>();
  final _maxQuestionsFieldKey = GlobalKey<FormFieldState<String>>();

  var _filters = const PackageSearchFilters();
  var _pendingFilters = const PackageSearchFilters();
  var _showFilters = false;
  Timer? _debounce;

  @override
  void initState() {
    _applyFilters();
    super.initState();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _onSearchChanged() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), _applyFilters);
  }

  void _applyFilters() {
    setState(() {
      _filters = _pendingFilters;
    });
    _updateFilters();
  }

  void _updateFilters() {
    _controller.updateFilters(_filters);
    _controller.pagingController.refresh();
  }

  void _clearFilters() {
    setState(() {
      _filters = _filters.clearAll();
      _pendingFilters = _filters;
    });
    _searchFieldKey.currentState?.didChange('');
    _minRoundsFieldKey.currentState?.didChange('');
    _maxRoundsFieldKey.currentState?.didChange('');
    _minQuestionsFieldKey.currentState?.didChange('');
    _maxQuestionsFieldKey.currentState?.didChange('');
    _controller.updateFilters(_filters);
    _controller.pagingController.refresh();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);

    return AdaptiveDialog(
      useScrollView: false,
      builder: (context) => Card(
        elevation: 0,
        clipBehavior: Clip.antiAlias,
        child: RefreshIndicator.adaptive(
          onRefresh: () async => _controller.pagingController.refresh(),
          child: CustomScrollView(
            slivers: [
              _buildSliverAppBar(context),
              if (_filters.hasActiveFilters)
                SliverToBoxAdapter(
                  child: _buildActiveFilters(context),
                ),
              PaginatedListSliverWidget<
                PackagesListController,
                PackageListItem
              >(
                itemBuilder: (_, item, _) => PackageListItemWidget(item: item),
                noItemsFoundIndicatorBuilder: (_) => Container(
                  height: max(size.height - 150, 500),
                  alignment: Alignment.topCenter,
                  padding: 16.all + 16.top,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    spacing: 16,
                    children: [
                      Icon(
                        Icons.inbox_rounded,
                        size: 64,
                        color: context.theme.colorScheme.onSurfaceVariant,
                      ),
                      Text(
                        LocaleKeys.no_packages_found.tr(),
                        style: context.textTheme.bodyLarge,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSliverAppBar(BuildContext context) {
    return SliverAppBar(
      pinned: true,
      elevation: 0,
      automaticallyImplyLeading: false,
      expandedHeight: _showFilters ? _filtersPanelExpandedHeight : null,
      stretch: true,
      floating: true,
      title: Row(
        children: [
          Icon(
            Icons.search_rounded,
            size: 28,
            color: context.theme.colorScheme.primary,
          ).paddingRight(12),
          Expanded(
            child: Text(
              LocaleKeys.search_packages.tr(),
              style: context.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w600,
                color: context.theme.colorScheme.onSurface,
              ),
            ),
          ),
          IconButton(
            icon: Icon(
              _showFilters ? Icons.filter_list_off : Icons.filter_list,
            ),
            tooltip: _showFilters
                ? LocaleKeys.hide_filters.tr()
                : LocaleKeys.show_filters.tr(),
            onPressed: () {
              setState(() {
                _showFilters = !_showFilters;
              });
            },
          ),
        ],
      ),
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(80),
        child: _buildSearchBar(context),
      ),
      flexibleSpace: FlexibleSpaceBar(
        background: Column(
          children: [
            const SizedBox(height: 64), // Space for the title

            if (_showFilters)
              Expanded(
                child: SingleChildScrollView(
                  child: _buildFiltersSection(context),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchBar(BuildContext context) {
    return ColoredBox(
      color: context.theme.colorScheme.surfaceContainer,
      child: TextFormField(
        key: _searchFieldKey,
        decoration: InputDecoration(
          hintText: LocaleKeys.search_placeholder.tr(),
          prefixIcon: const Icon(Icons.search),
          suffixIcon: (_pendingFilters.title?.isNotEmpty ?? false)
              ? IconButton(
                  icon: const Icon(Icons.clear),
                  onPressed: () {
                    setState(() {
                      _pendingFilters = _pendingFilters.copyWith(title: null);
                    });
                    _searchFieldKey.currentState?.didChange('');
                    _applyFilters();
                  },
                )
              : null,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        onChanged: (value) {
          setState(() {
            _pendingFilters = _pendingFilters.copyWith(
              title: value.isEmpty ? null : value,
            );
          });
          _onSearchChanged();
        },
      ).paddingAll(16),
    );
  }

  Widget _buildFiltersSection(BuildContext context) {
    return Card(
      margin: 16.all,
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 16,
        children: [
          Text(
            LocaleKeys.filters.tr(),
            style: context.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          _buildRoundsFilter(context),
          _buildQuestionsFilter(context),
          _buildAgeRestrictionFilter(context),
          _buildSortOptions(context),
          Row(
            spacing: 8,
            children: [
              Expanded(
                child: FilledButton.tonal(
                  onPressed: _clearFilters,
                  child: Text(LocaleKeys.clear_filters.tr()),
                ),
              ),
              Expanded(
                child: FilledButton(
                  onPressed: _applyFilters,
                  child: Text(LocaleKeys.apply.tr()),
                ),
              ),
            ],
          ),
        ],
      ).paddingAll(16),
    );
  }

  Widget _buildRoundsFilter(BuildContext context) {
    return Row(
      spacing: 8,
      children: [
        Expanded(
          child: TextFormField(
            key: _minRoundsFieldKey,
            decoration: InputDecoration(
              labelText: LocaleKeys.filter_by_rounds.tr(),
              hintText: LocaleKeys.min.tr(),
              border: const OutlineInputBorder(),
            ),
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (value) {
              setState(() {
                _pendingFilters = _pendingFilters.copyWith(
                  minRounds: value.isEmpty ? null : int.tryParse(value),
                );
              });
            },
          ),
        ),
        const Text('—'),
        Expanded(
          child: TextFormField(
            key: _maxRoundsFieldKey,
            decoration: InputDecoration(
              hintText: LocaleKeys.max.tr(),
              border: const OutlineInputBorder(),
            ),
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (value) {
              setState(() {
                _pendingFilters = _pendingFilters.copyWith(
                  maxRounds: value.isEmpty ? null : int.tryParse(value),
                );
              });
            },
          ),
        ),
      ],
    );
  }

  Widget _buildQuestionsFilter(BuildContext context) {
    return Row(
      spacing: 8,
      children: [
        Expanded(
          child: TextFormField(
            key: _minQuestionsFieldKey,
            decoration: InputDecoration(
              labelText: LocaleKeys.filter_by_questions.tr(),
              hintText: LocaleKeys.min.tr(),
              border: const OutlineInputBorder(),
            ),
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (value) {
              setState(() {
                _pendingFilters = _pendingFilters.copyWith(
                  minQuestions: value.isEmpty ? null : int.tryParse(value),
                );
              });
            },
          ),
        ),
        const Text('—'),
        Expanded(
          child: TextFormField(
            key: _maxQuestionsFieldKey,
            decoration: InputDecoration(
              hintText: LocaleKeys.max.tr(),
              border: const OutlineInputBorder(),
            ),
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (value) {
              setState(() {
                _pendingFilters = _pendingFilters.copyWith(
                  maxQuestions: value.isEmpty ? null : int.tryParse(value),
                );
              });
            },
          ),
        ),
      ],
    );
  }

  Widget _buildAgeRestrictionFilter(BuildContext context) {
    return DropdownButtonFormField<AgeRestriction?>(
      initialValue: _pendingFilters.ageRestriction,
      decoration: InputDecoration(
        labelText: LocaleKeys.filter_by_age.tr(),
        border: const OutlineInputBorder(),
      ),
      items: AgeRestriction.values
          .whereNot((e) => e == AgeRestriction.$unknown)
          .map(
            (age) => DropdownMenuItem(
              value: age,
              child: Text(age.f()),
            ),
          )
          .toList(),
      onChanged: (value) {
        setState(() {
          _pendingFilters = _pendingFilters.copyWith(ageRestriction: value);
        });
      },
    );
  }

  Widget _buildSortOptions(BuildContext context) {
    return Row(
      spacing: 8,
      children: [
        Expanded(
          child: DropdownButtonFormField<PackagesSortBy>(
            initialValue: _filters.sortBy,
            decoration: InputDecoration(
              labelText: LocaleKeys.sort_by.tr(),
              border: const OutlineInputBorder(),
            ),
            items: [
              DropdownMenuItem(
                value: PackagesSortBy.createdAt,
                child: Text(LocaleKeys.sort_created_at.tr()),
              ),
              DropdownMenuItem(
                value: PackagesSortBy.title,
                child: Text(LocaleKeys.sort_title.tr()),
              ),
              DropdownMenuItem(
                value: PackagesSortBy.author,
                child: Text(LocaleKeys.sort_author.tr()),
              ),
              DropdownMenuItem(
                value: PackagesSortBy.id,
                child: Text(LocaleKeys.sort_id.tr()),
              ),
            ],
            onChanged: (value) {
              if (value != null) {
                setState(() {
                  _filters = _filters.copyWith(sortBy: value);
                  _pendingFilters = _pendingFilters.copyWith(sortBy: value);
                });
                _updateFilters();
              }
            },
          ),
        ),
        Expanded(
          child: DropdownButtonFormField<OrderDirection>(
            initialValue: _filters.order,
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
            ),
            items: [
              DropdownMenuItem(
                value: OrderDirection.asc,
                child: Text(LocaleKeys.order_asc.tr()),
              ),
              DropdownMenuItem(
                value: OrderDirection.desc,
                child: Text(LocaleKeys.order_desc.tr()),
              ),
            ],
            onChanged: (value) {
              if (value != null) {
                setState(() {
                  _filters = _filters.copyWith(order: value);
                  _pendingFilters = _pendingFilters.copyWith(order: value);
                });
                _updateFilters();
              }
            },
          ),
        ),
      ],
    );
  }

  Widget _buildActiveFilters(BuildContext context) {
    return Card(
      margin: 16.all,
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 8,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  LocaleKeys.active_filters.tr(),
                  style: context.textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              TextButton(
                onPressed: _clearFilters,
                child: Text(LocaleKeys.clear_filters.tr()),
              ),
            ],
          ),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (_filters.title != null)
                _buildFilterChip(
                  [LocaleKeys.sort_title.tr(), _filters.title].join(': '),
                  () {
                    setState(() {
                      _pendingFilters = _pendingFilters.copyWith(title: null);
                    });
                    _searchFieldKey.currentState?.didChange('');
                    _applyFilters();
                  },
                ),
              if (_filters.minRounds != null || _filters.maxRounds != null)
                _buildFilterChip(
                  [
                    '${LocaleKeys.filter_by_rounds.tr()}:',
                    _filters.minRounds?.toString() ?? LocaleKeys.any.tr(),
                    '-',
                    _filters.maxRounds?.toString() ?? LocaleKeys.any.tr(),
                  ].join(' '),
                  () {
                    setState(() {
                      _pendingFilters = _pendingFilters.copyWith(
                        minRounds: null,
                        maxRounds: null,
                      );
                    });
                    _minRoundsFieldKey.currentState?.didChange('');
                    _maxRoundsFieldKey.currentState?.didChange('');
                    _applyFilters();
                  },
                ),
              if (_filters.minQuestions != null ||
                  _filters.maxQuestions != null)
                _buildFilterChip(
                  [
                    '${LocaleKeys.filter_by_questions.tr()}:',
                    _filters.minQuestions?.toString() ?? LocaleKeys.any.tr(),
                    '-',
                    _filters.maxQuestions?.toString() ?? LocaleKeys.any.tr(),
                  ].join(' '),
                  () {
                    setState(() {
                      _pendingFilters = _pendingFilters.copyWith(
                        minQuestions: null,
                        maxQuestions: null,
                      );
                    });
                    _minQuestionsFieldKey.currentState?.didChange('');
                    _maxQuestionsFieldKey.currentState?.didChange('');
                    _applyFilters();
                  },
                ),
              if (_filters.ageRestriction != null)
                _buildFilterChip(
                  [
                    LocaleKeys.filter_by_age.tr(),
                    _filters.ageRestriction!.f(),
                  ].join(': '),
                  () {
                    setState(() {
                      _pendingFilters = _pendingFilters.copyWith(
                        ageRestriction: null,
                      );
                    });
                    _applyFilters();
                  },
                ),
            ],
          ),
        ],
      ).paddingAll(16),
    );
  }

  Widget _buildFilterChip(String label, VoidCallback onRemove) {
    return Chip(
      label: Text(label),
      deleteIcon: const Icon(Icons.close, size: 18),
      onDeleted: onRemove,
    );
  }
}
