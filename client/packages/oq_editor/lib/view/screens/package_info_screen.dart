import 'package:flutter/material.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_shared/oq_shared.dart';
import 'package:watch_it/watch_it.dart';

/// First step in the editor: edit package basic information
class PackageInfoScreen extends WatchingWidget {
  const PackageInfoScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final package = watchValue((OqEditorController c) => c.package);
    final translations = controller.translations;

    return MaxSizeContainer(
      maxWidth: UiModeUtils.maximumDialogWidth,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Title
            Text(
              translations.packageInfo,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 24),

            // Package title field
            TextFormField(
              initialValue: package.title,
              decoration: InputDecoration(
                labelText: translations.packageTitle,
                border: const OutlineInputBorder(),
                filled: true,
              ),
              onChanged: (value) => controller.updatePackageInfo(title: value),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return translations.fieldRequired;
                }
                if (value.length < 3) {
                  return translations.minLengthError(3);
                }
                if (value.length > 100) {
                  return translations.maxLengthError(100);
                }
                return null;
              },
              maxLength: 100,
            ),
            const SizedBox(height: 16),

            // Description field
            TextFormField(
              initialValue: package.description,
              decoration: InputDecoration(
                labelText: translations.packageDescription,
                border: const OutlineInputBorder(),
                filled: true,
              ),
              onChanged: (value) =>
                  controller.updatePackageInfo(description: value),
              maxLines: 4,
              maxLength: 500,
            ),
            const SizedBox(height: 16),

            // Language field
            TextFormField(
              initialValue: package.language,
              decoration: InputDecoration(
                labelText: translations.packageLanguage,
                border: const OutlineInputBorder(),
                filled: true,
                hintText: 'en, ru, es...',
              ),
              onChanged: (value) =>
                  controller.updatePackageInfo(language: value),
              maxLength: 10,
            ),
            const SizedBox(height: 16),

            // Age restriction selector
            _AgeRestrictionSection(
              currentRestriction: package.ageRestriction,
              onChanged: (restriction) =>
                  controller.updatePackageInfo(ageRestriction: restriction),
            ),
            const SizedBox(height: 24),

            // Next button
            FilledButton.icon(
              onPressed: controller.navigateToRoundsList,
              icon: const Icon(Icons.arrow_forward),
              label: Text(translations.nextButton),
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

class _AgeRestrictionSection extends StatelessWidget {
  const _AgeRestrictionSection({
    required this.currentRestriction,
    required this.onChanged,
  });

  final AgeRestriction currentRestriction;
  final void Function(AgeRestriction) onChanged;

  @override
  Widget build(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final translations = controller.translations;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          translations.packageAgeRestriction,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: AgeRestriction.values
              .where((r) => r != AgeRestriction.$unknown)
              .map((restriction) {
                return ChoiceChip(
                  label: Text(_formatAgeRestriction(restriction)),
                  selected: currentRestriction == restriction,
                  onSelected: (_) => onChanged(restriction),
                  showCheckmark: false,
                );
              })
              .toList(),
        ),
      ],
    );
  }

  String _formatAgeRestriction(AgeRestriction restriction) {
    final controller = GetIt.I<OqEditorController>();
    final translations = controller.translations;

    switch (restriction) {
      case AgeRestriction.a18:
        return '18+';
      case AgeRestriction.a16:
        return '16+';
      case AgeRestriction.a12:
        return '12+';
      case AgeRestriction.none:
        return translations.ageRestrictionNone;
      case AgeRestriction.$unknown:
        return translations.ageRestrictionUnknown;
    }
  }
}
