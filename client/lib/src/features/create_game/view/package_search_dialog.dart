import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

@RoutePage(deferredLoading: false)
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
  bool _showFilters = false;

  @override
  void dispose() {
    _searchController.dispose();
    _minRoundsController.dispose();
    _maxRoundsController.dispose();
    _minQuestionsController.dispose();
    _maxQuestionsController.dispose();
    super.dispose();
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
      _showFilters = false;
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
            Expanded(
              child: PaginatedListWidget<PackagesListController,
                  PackageListItem>(
                itemBuilder: (context, item, index) => InkWell(
                  onTap: () => Navigator.of(context).pop(item),
                  child: PackageListItemWidget(item: item),
                ),
              ),
            ),
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
              color: context.theme.colorScheme.primary,
            ),
            onPressed: () => setState(() => _showFilters = !_showFilters),
            tooltip: LocaleKeys.filters.tr(),
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
              labelText: LocaleKeys.filter_by_rounds.tr(),
              hintText: LocaleKeys.min.tr(),
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
              hintText: LocaleKeys.max.tr(),
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
              labelText: LocaleKeys.filter_by_questions.tr(),
              hintText: LocaleKeys.min.tr(),
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
              hintText: LocaleKeys.max.tr(),
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
        labelText: LocaleKeys.filter_by_age.tr(),
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
            value: _filters.order,
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
                  'Title: ${_filters.title}',
                  () {
                    _searchController.clear();
                    _applyFilters();
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
                    _controller.updateFilters(_filters);
                    _controller.pagingController.refresh();
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
                    _controller.updateFilters(_filters);
                    _controller.pagingController.refresh();
                  },
                ),
              if (_filters.ageRestriction != null)
                _buildFilterChip(
                  'Age: ${_filters.ageRestriction!.name}',
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
}
