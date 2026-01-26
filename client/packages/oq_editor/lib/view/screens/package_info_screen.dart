import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/router/router.gr.dart';
import 'package:oq_editor/utils/package_editor_validators.dart';
import 'package:oq_shared/oq_shared.dart';
import 'package:watch_it/watch_it.dart';

/// First step in the editor: edit package basic information
@RoutePage()
class PackageInfoScreen extends WatchingWidget {
  const PackageInfoScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final package = watchValue((OqEditorController c) => c.package);
    final translations = controller.translations;
    final formKey = createOnce(GlobalKey<FormState>.new);

    return Scaffold(
      body: MaxSizeContainer(
        maxWidth: UiModeUtils.maximumDialogWidth(context),
        child: Form(
          key: formKey,
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
                  ),
                  onChanged: (value) =>
                      controller.updatePackageInfo(title: value),
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
                  ),
                  onChanged: (value) =>
                      controller.updatePackageInfo(description: value),
                  maxLines: 4,
                  maxLength: 500,
                  validator: (value) =>
                      PackageEditorValidators.validateStringLength(
                        value,
                        null,
                        500,
                      ),
                ),
                const SizedBox(height: 16),

                // Language field
                TextFormField(
                  initialValue: package.language,
                  decoration: InputDecoration(
                    labelText: translations.packageLanguage,
                    hintText: 'en, ua, es...',
                  ),
                  onChanged: (value) =>
                      controller.updatePackageInfo(language: value),
                  maxLength: 10,
                  validator: (value) =>
                      PackageEditorValidators.validateStringLength(
                        value,
                        2,
                        10,
                      ),
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
                  onPressed: () async {
                    if (!(formKey.currentState?.validate() ?? false)) return;
                    FocusScope.of(context).unfocus();
                    await context.router.push(const RoundsListRoute());
                  },
                  icon: const Icon(Icons.arrow_forward),
                  label: Text(translations.nextButton),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              ],
            ),
          ),
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
    final hasValidSelection = currentRestriction != AgeRestriction.$unknown;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          translations.packageAgeRestriction,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w500,
            color: hasValidSelection
                ? null
                : Theme.of(context).colorScheme.error,
          ),
        ),
        const SizedBox(height: 12),
        Container(
          decoration: hasValidSelection
              ? null
              : BoxDecoration(
                  border: Border.all(
                    color: Theme.of(
                      context,
                    ).colorScheme.error.withValues(alpha: .5),
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
          padding: hasValidSelection ? null : const EdgeInsets.all(8),
          child: Wrap(
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
        ),
        if (!hasValidSelection) ...[
          const SizedBox(height: 8),
          Text(
            translations.fieldRequired,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.error,
            ),
          ),
        ],
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
