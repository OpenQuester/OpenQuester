import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:nb_utils/nb_utils.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/router/router.gr.dart';
import 'package:watch_it/watch_it.dart';

/// Edit a specific round
@RoutePage()
class RoundEditorScreen extends WatchingWidget {
  const RoundEditorScreen({
    @pathParam required this.roundIndex,
    super.key,
  });
  final int roundIndex;

  @override
  Widget build(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final package = watchValue((OqEditorController c) => c.package);

    final translations = controller.translations;

    if (roundIndex >= package.rounds.length) {
      return Scaffold(
        body: Text(translations.invalidRound).center(),
      );
    }

    final round = package.rounds[roundIndex];

    return Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header with back button
            Row(
              children: [
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
              onPressed: () =>
                  context.router.push(ThemesGridRoute(roundIndex: roundIndex)),
              icon: const Icon(Icons.grid_view),
              label: Text(
                '${translations.themes} (${round.themes.length})',
              ),
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
          ],
        ),
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
    final controller = GetIt.I<OqEditorController>();
    final translations = controller.translations;

    switch (type) {
      case PackageRoundType.simple:
        return translations.roundTypeSimple;
      case PackageRoundType.valueFinal:
        return translations.roundTypeFinal;
      case PackageRoundType.$unknown:
        return translations.roundTypeUnknown;
    }
  }
}
