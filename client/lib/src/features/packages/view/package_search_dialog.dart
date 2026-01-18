import 'dart:async';

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
  final _searchController = TextEditingController();
  final _minRoundsController = TextEditingController();
  final _maxRoundsController = TextEditingController();
  final _minQuestionsController = TextEditingController();
  final _maxQuestionsController = TextEditingController();

  var _filters = const PackageSearchFilters();
  var _showFilters = false;
  Timer? _debounce;

  @override
  void dispose() {
    _searchController.dispose();
    _minRoundsController.dispose();
    _maxRoundsController.dispose();
    _minQuestionsController.dispose();
    _maxQuestionsController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onSearchChanged() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), _applyFilters);
  }

  void _applyFilters() {
    setState(() {
      _filters = _filters.copyWith(
        title: _searchController.text.isEmpty ? null : _searchController.text,
        minRounds: _minRoundsController.text.isEmpty
            ? null
            : int.tryParse(_minRoundsController.text),
        maxRounds: _maxRoundsController.text.isEmpty
            ? null
            : int.tryParse(_maxRoundsController.text),
        minQuestions: _minQuestionsController.text.isEmpty
            ? null
            : int.tryParse(_minQuestionsController.text),
        maxQuestions: _maxQuestionsController.text.isEmpty
            ? null
            : int.tryParse(_maxQuestionsController.text),
      );
    });
    _controller.updateFilters(_filters);
    _controller.pagingController.refresh();
  }

  void _clearFilters() {
    setState(() {
      _filters = _filters.clearAll();
      _searchController.clear();
      _minRoundsController.clear();
      _maxRoundsController.clear();
      _minQuestionsController.clear();
      _maxQuestionsController.clear();
    });
    _controller.updateFilters(_filters);
    _controller.pagingController.refresh();
  }

  @override
  Widget build(BuildContext context) {
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
      child: TextField(
        controller: _searchController,
        decoration: InputDecoration(
          hintText: LocaleKeys.search_placeholder.tr(),
          prefixIcon: const Icon(Icons.search),
          suffixIcon: _searchController.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear),
                  onPressed: () {
                    _searchController.clear();
                    _applyFilters();
                  },
                )
              : null,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        onSubmitted: (_) => _applyFilters(),
        onChanged: (_) => _onSearchChanged(),
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
            controller: _minRoundsController,
            decoration: InputDecoration(
              labelText: LocaleKeys.filter_by_rounds.tr(),
              hintText: LocaleKeys.min.tr(),
              border: const OutlineInputBorder(),
            ),
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          ),
        ),
        const Text('—'),
        Expanded(
          child: TextFormField(
            controller: _maxRoundsController,
            decoration: InputDecoration(
              hintText: LocaleKeys.max.tr(),
              border: const OutlineInputBorder(),
            ),
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
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
            controller: _minQuestionsController,
            decoration: InputDecoration(
              labelText: LocaleKeys.filter_by_questions.tr(),
              hintText: LocaleKeys.min.tr(),
              border: const OutlineInputBorder(),
            ),
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          ),
        ),
        const Text('—'),
        Expanded(
          child: TextFormField(
            controller: _maxQuestionsController,
            decoration: InputDecoration(
              hintText: LocaleKeys.max.tr(),
              border: const OutlineInputBorder(),
            ),
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          ),
        ),
      ],
    );
  }

  Widget _buildAgeRestrictionFilter(BuildContext context) {
    return DropdownButtonFormField<AgeRestriction?>(
      initialValue: _filters.ageRestriction,
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
          _filters = _filters.copyWith(ageRestriction: value);
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
                });
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
                });
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
                    _searchController.clear();
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
                      _filters = _filters.copyWith(
                        minRounds: null,
                        maxRounds: null,
                      );
                      _minRoundsController.clear();
                      _maxRoundsController.clear();
                    });
                    _controller.updateFilters(_filters);
                    _controller.pagingController.refresh();
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
                      _filters = _filters.copyWith(
                        minQuestions: null,
                        maxQuestions: null,
                      );
                      _minQuestionsController.clear();
                      _maxQuestionsController.clear();
                    });
                    _controller.updateFilters(_filters);
                    _controller.pagingController.refresh();
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
                      _filters = _filters.copyWith(ageRestriction: null);
                    });
                    _controller.updateFilters(_filters);
                    _controller.pagingController.refresh();
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
