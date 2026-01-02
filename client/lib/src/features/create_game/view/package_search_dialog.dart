import 'dart:async';

import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

/// A beautiful, comprehensive package search dialog with filters
class PackageSearchDialog extends StatefulWidget {
  const PackageSearchDialog({super.key});

  @override
  State<PackageSearchDialog> createState() => _PackageSearchDialogState();
}

class _PackageSearchDialogState extends State<PackageSearchDialog> {
  final _controller = getIt<PackagesListController>();
  final _searchController = TextEditingController();
  final _minRoundsController = TextEditingController();
  final _maxRoundsController = TextEditingController();
  final _minQuestionsController = TextEditingController();
  final _maxQuestionsController = TextEditingController();

  var _filters = const PackageSearchFilters();
  Timer? _debounce;
  List<PackageListItem> _results = [];
  bool _isLoading = false;
  bool _showFilters = false;

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_onSearchChanged);
    _loadInitialResults();
  }

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
    _debounce = Timer(const Duration(milliseconds: 500), () {
      _applySearch();
    });
  }

  void _applySearch() {
    setState(() {
      _filters = _filters.copyWith(
        title: _searchController.text.isEmpty ? null : _searchController.text,
      );
    });
    _performSearch();
  }

  Future<void> _loadInitialResults() async {
    setState(() => _isLoading = true);
    try {
      final response = await _controller.getPage(
        ListRequest(offset: 0, limit: 10),
      );
      setState(() {
        _results = response.list;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        await getIt<ToastController>().show(
          LocaleKeys.something_went_wrong.tr(),
        );
      }
    }
  }

  Future<void> _performSearch() async {
    setState(() => _isLoading = true);
    try {
      final list = await Api.I.api.packages.getV1Packages(
        limit: 10,
        offset: 0,
        order: _filters.order,
        sortBy: _filters.sortBy,
        title: _filters.title,
        description: _filters.description,
        language: _filters.language,
        authorId: _filters.authorId,
        tags: _filters.tags,
        ageRestriction: _filters.ageRestriction,
        minRounds: _filters.minRounds,
        maxRounds: _filters.maxRounds,
        minQuestions: _filters.minQuestions,
        maxQuestions: _filters.maxQuestions,
      );
      setState(() {
        _results = list.data;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        await getIt<ToastController>().show(
          LocaleKeys.something_went_wrong.tr(),
        );
      }
    }
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
    _performSearch();
  }

  void _applyFilters() {
    setState(() {
      _filters = _filters.copyWith(
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
      _showFilters = false;
    });
    _performSearch();
  }

  @override
  Widget build(BuildContext context) {
    return AdaptiveDialog(
      builder: (context) => Card(
        elevation: 0,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildHeader(context),
            _buildSearchBar(context),
            if (_showFilters) _buildFiltersSection(context),
            if (_filters.hasActiveFilters) _buildActiveFilters(context),
            _buildResultsList(context),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
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
          Icon(
            Icons.search_rounded,
            size: 28,
            color: context.theme.colorScheme.primary,
          ).paddingRight(12),
          Expanded(
            child: Text(
              LocaleKeys.package_search_title.tr(),
              style: context.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w600,
                color: context.theme.colorScheme.onSurface,
              ),
            ),
          ),
          IconButton(
            icon: Icon(
              _showFilters ? Icons.filter_list_off : Icons.filter_list,
              color: context.theme.colorScheme.primary,
            ),
            onPressed: () => setState(() => _showFilters = !_showFilters),
            tooltip: LocaleKeys.package_search_filters.tr(),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar(BuildContext context) {
    return Padding(
      padding: 16.all,
      child: TextField(
        controller: _searchController,
        decoration: InputDecoration(
          hintText: LocaleKeys.package_search_search_placeholder.tr(),
          prefixIcon: const Icon(Icons.search),
          suffixIcon: _searchController.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear),
                  onPressed: () {
                    _searchController.clear();
                    _applySearch();
                  },
                )
              : null,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }

  Widget _buildFiltersSection(BuildContext context) {
    return Container(
      padding: 16.all,
      decoration: BoxDecoration(
        color: context.theme.colorScheme.surfaceContainerHighest.withValues(
          alpha: 0.3,
        ),
        border: Border(
          top: BorderSide(
            color: context.theme.colorScheme.outline.withValues(alpha: 0.2),
          ),
          bottom: BorderSide(
            color: context.theme.colorScheme.outline.withValues(alpha: 0.2),
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 16,
        children: [
          Text(
            LocaleKeys.package_search_filters.tr(),
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
                  child: Text(LocaleKeys.package_search_clear_filters.tr()),
                ),
              ),
              Expanded(
                child: FilledButton(
                  onPressed: _applyFilters,
                  child: Text(LocaleKeys.package_search_apply.tr()),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRoundsFilter(BuildContext context) {
    return Row(
      spacing: 8,
      children: [
        Expanded(
          child: TextField(
            controller: _minRoundsController,
            decoration: InputDecoration(
              labelText: LocaleKeys.package_search_filter_by_rounds.tr(),
              hintText: LocaleKeys.package_search_min.tr(),
              border: const OutlineInputBorder(),
            ),
            keyboardType: TextInputType.number,
          ),
        ),
        const Text('—'),
        Expanded(
          child: TextField(
            controller: _maxRoundsController,
            decoration: InputDecoration(
              hintText: LocaleKeys.package_search_max.tr(),
              border: const OutlineInputBorder(),
            ),
            keyboardType: TextInputType.number,
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
          child: TextField(
            controller: _minQuestionsController,
            decoration: InputDecoration(
              labelText: LocaleKeys.package_search_filter_by_questions.tr(),
              hintText: LocaleKeys.package_search_min.tr(),
              border: const OutlineInputBorder(),
            ),
            keyboardType: TextInputType.number,
          ),
        ),
        const Text('—'),
        Expanded(
          child: TextField(
            controller: _maxQuestionsController,
            decoration: InputDecoration(
              hintText: LocaleKeys.package_search_max.tr(),
              border: const OutlineInputBorder(),
            ),
            keyboardType: TextInputType.number,
          ),
        ),
      ],
    );
  }

  Widget _buildAgeRestrictionFilter(BuildContext context) {
    return DropdownButtonFormField<AgeRestriction?>(
      value: _filters.ageRestriction,
      decoration: InputDecoration(
        labelText: LocaleKeys.package_search_filter_by_age.tr(),
        border: const OutlineInputBorder(),
      ),
      items: [
        DropdownMenuItem<AgeRestriction?>(
          value: null,
          child: Text(LocaleKeys.none.tr()),
        ),
        ...AgeRestriction.values.map(
          (age) => DropdownMenuItem(
            value: age,
            child: Text(age.name),
          ),
        ),
      ],
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
            value: _filters.sortBy,
            decoration: InputDecoration(
              labelText: LocaleKeys.package_search_sort_by.tr(),
              border: const OutlineInputBorder(),
            ),
            items: [
              DropdownMenuItem(
                value: PackagesSortBy.createdAt,
                child: Text(LocaleKeys.package_search_sort_created_at.tr()),
              ),
              DropdownMenuItem(
                value: PackagesSortBy.title,
                child: Text(LocaleKeys.package_search_sort_title.tr()),
              ),
              DropdownMenuItem(
                value: PackagesSortBy.author,
                child: Text(LocaleKeys.package_search_sort_author.tr()),
              ),
              DropdownMenuItem(
                value: PackagesSortBy.id,
                child: Text(LocaleKeys.package_search_sort_id.tr()),
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
            value: _filters.order,
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
            ),
            items: [
              DropdownMenuItem(
                value: OrderDirection.asc,
                child: Text(LocaleKeys.package_search_order_asc.tr()),
              ),
              DropdownMenuItem(
                value: OrderDirection.desc,
                child: Text(LocaleKeys.package_search_order_desc.tr()),
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
    return Container(
      padding: 12.all,
      decoration: BoxDecoration(
        color: context.theme.colorScheme.secondaryContainer.withValues(
          alpha: 0.3,
        ),
        border: Border(
          bottom: BorderSide(
            color: context.theme.colorScheme.outline.withValues(alpha: 0.2),
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 8,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  LocaleKeys.package_search_active_filters.tr(),
                  style: context.textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              TextButton(
                onPressed: _clearFilters,
                child: Text(LocaleKeys.package_search_clear_filters.tr()),
              ),
            ],
          ),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (_filters.title != null)
                _buildFilterChip(
                  'Title: ${_filters.title}',
                  () {
                    _searchController.clear();
                    _applySearch();
                  },
                ),
              if (_filters.minRounds != null || _filters.maxRounds != null)
                _buildFilterChip(
                  'Rounds: ${_filters.minRounds ?? '∞'} - ${_filters.maxRounds ?? '∞'}',
                  () {
                    setState(() {
                      _filters = _filters.copyWith(
                        minRounds: null,
                        maxRounds: null,
                      );
                      _minRoundsController.clear();
                      _maxRoundsController.clear();
                    });
                    _performSearch();
                  },
                ),
              if (_filters.minQuestions != null ||
                  _filters.maxQuestions != null)
                _buildFilterChip(
                  'Questions: ${_filters.minQuestions ?? '∞'} - ${_filters.maxQuestions ?? '∞'}',
                  () {
                    setState(() {
                      _filters = _filters.copyWith(
                        minQuestions: null,
                        maxQuestions: null,
                      );
                      _minQuestionsController.clear();
                      _maxQuestionsController.clear();
                    });
                    _performSearch();
                  },
                ),
              if (_filters.ageRestriction != null)
                _buildFilterChip(
                  'Age: ${_filters.ageRestriction!.name}',
                  () {
                    setState(() {
                      _filters = _filters.copyWith(ageRestriction: null);
                    });
                    _performSearch();
                  },
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, VoidCallback onRemove) {
    return Chip(
      label: Text(label),
      deleteIcon: const Icon(Icons.close, size: 18),
      onDeleted: onRemove,
    );
  }

  Widget _buildResultsList(BuildContext context) {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(),
      ).paddingAll(32);
    }

    if (_results.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          spacing: 8,
          children: [
            Icon(
              Icons.inbox_outlined,
              size: 64,
              color: context.theme.colorScheme.onSurface.withValues(
                alpha: 0.5,
              ),
            ),
            Text(
              LocaleKeys.nothing_found.tr(),
              style: context.textTheme.titleMedium?.copyWith(
                color: context.theme.colorScheme.onSurface.withValues(
                  alpha: 0.7,
                ),
              ),
            ),
          ],
        ).paddingAll(32),
      );
    }

    return Flexible(
      child: ListView.separated(
        shrinkWrap: true,
        itemCount: _results.length,
        separatorBuilder: (_, __) => Divider(
          height: 1,
          color: context.theme.colorScheme.outline.withValues(alpha: 0.2),
        ),
        itemBuilder: (context, index) {
          final item = _results[index];
          return InkWell(
            onTap: () => Navigator.of(context).pop(item),
            child: PackageListItemWidget(item: item),
          );
        },
      ),
    );
  }
}
