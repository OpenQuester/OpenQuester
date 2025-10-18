import 'package:flutter/material.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:watch_it/watch_it.dart';

/// Edit a specific round
class RoundEditorScreen extends WatchingWidget {
  const RoundEditorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final package = watchValue((OqEditorController c) => c.package);
    final navContext = watchValue(
      (OqEditorController c) => c.navigationContext,
    );
    final translations = controller.translations;

    final roundIndex = navContext.roundIndex;
    if (roundIndex == null || roundIndex >= package.rounds.length) {
      return const Center(child: Text('Invalid round'));
    }

    final round = package.rounds[roundIndex];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header with back button
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: controller.navigateBack,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  translations.editRound,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Round name field
          TextFormField(
            initialValue: round.name,
            decoration: InputDecoration(
              labelText: translations.roundName,
              border: const OutlineInputBorder(),
              filled: true,
            ),
            onChanged: (value) {
              controller.updateRound(
                roundIndex,
                round.copyWith(name: value),
              );
            },
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return translations.fieldRequired;
              }
              return null;
            },
            maxLength: 100,
          ),
          const SizedBox(height: 16),

          // Description field
          TextFormField(
            initialValue: round.description,
            decoration: InputDecoration(
              labelText: translations.roundDescription,
              border: const OutlineInputBorder(),
              filled: true,
            ),
            onChanged: (value) {
              controller.updateRound(
                roundIndex,
                round.copyWith(description: value),
              );
            },
            maxLines: 3,
            maxLength: 300,
          ),
          const SizedBox(height: 16),

          // Round type selector
          _RoundTypeSection(
            currentType: round.type,
            onChanged: (type) {
              controller.updateRound(
                roundIndex,
                round.copyWith(type: type),
              );
            },
          ),
          const SizedBox(height: 24),

          // Navigate to themes button
          FilledButton.icon(
            onPressed: () => controller.navigateToThemesGrid(roundIndex),
            icon: const Icon(Icons.grid_view),
            label: Text('${translations.themes} (${round.themes.length})'),
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
          ),
        ],
      ),
    );
  }
}

class _RoundTypeSection extends StatelessWidget {
  const _RoundTypeSection({
    required this.currentType,
    required this.onChanged,
  });

  final PackageRoundType currentType;
  final void Function(PackageRoundType) onChanged;

  @override
  Widget build(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final translations = controller.translations;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          translations.roundType,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: PackageRoundType.values
              .where((t) => t != PackageRoundType.$unknown)
              .map((type) {
                return ChoiceChip(
                  label: Text(_formatRoundType(type)),
                  selected: currentType == type,
                  onSelected: (_) => onChanged(type),
                  showCheckmark: false,
                );
              })
              .toList(),
        ),
      ],
    );
  }

  String _formatRoundType(PackageRoundType type) {
    switch (type) {
      case PackageRoundType.simple:
        return 'Simple';
      case PackageRoundType.valueFinal:
        return 'Final';
      case PackageRoundType.$unknown:
        return 'Unknown';
    }
  }
}
