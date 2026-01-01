import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

@RoutePage()
class SettingsDialog extends StatelessWidget {
  const SettingsDialog({super.key});

  @override
  Widget build(BuildContext context) {
    return AdaptiveDialog(
      constraints: const BoxConstraints(maxWidth: 560),
      builder: (context) => Card(
        elevation: 0,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
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
                    Icons.settings_outlined,
                    color: context.theme.colorScheme.primary,
                  ),
                  Text(
                    LocaleKeys.settings_title.tr(),
                    style: context.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ).paddingLeft(8),
                ],
              ),
            ),
            const Divider(height: 1),
            ListView(
              shrinkWrap: true,
              padding: 12.all,
              children: const [
                SizedBox(height: 8),
                _AppearanceSection(),
                SizedBox(height: 8),
                _GameSettingsSection(),
                SizedBox(height: 8),
              ],
            ).flexible(),
          ],
        ).constrained(const BoxConstraints(minHeight: 500)),
      ),
    );
  }
}

class _AppearanceSection extends StatelessWidget {
  const _AppearanceSection();

  @override
  Widget build(BuildContext context) {
    return ExpansionTile(
      title: Text(LocaleKeys.theme_appearance.tr()),
      leading: const Icon(Icons.palette_outlined),
      expandedCrossAxisAlignment: CrossAxisAlignment.start,
      initiallyExpanded: true,
      childrenPadding: 12.horizontal + 12.bottom,
      children: const [
        _ThemeModeSelector(),
        Divider(),
        _SeedSelector(),
      ],
    );
  }
}

class _GameSettingsSection extends WatchingWidget {
  const _GameSettingsSection();

  @override
  Widget build(BuildContext context) {
    final controller = getIt<SettingsController>();

    return ExpansionTile(
      title: Text(LocaleKeys.game_settings.tr()),
      leading: const Icon(Icons.tune_outlined),
      expandedCrossAxisAlignment: CrossAxisAlignment.start,
      initiallyExpanded: true,
      children: [
        _BoolSetting(
          title: LocaleKeys.settings_limit_desktop_width.tr(),
          state: watchPropertyValue(
            (SettingsController m) => m.settings.limitDesktopWidth,
          ),
          onChanged: (value) => controller.updateSettings(
            controller.settings.copyWith(
              limitDesktopWidth: value,
            ),
          ),
        ),
      ],
    );
  }
}

class _BoolSetting extends StatelessWidget {
  const _BoolSetting({
    required this.title,
    required this.state,
    required this.onChanged,
  });
  final String title;
  final bool state;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(title),
      trailing: Switch(
        value: state,
        onChanged: onChanged,
      ),
    );
  }
}

class _ThemeModeSelector extends WatchingWidget {
  const _ThemeModeSelector();

  @override
  Widget build(BuildContext context) {
    final controller = watchIt<SettingsController>();

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: AppThemeMode.values.map((m) {
        final selected = m == controller.settings.themeMode;
        return ChoiceChip(
          label: Text(_label(m)),
          selected: selected,
          onSelected: (_) => controller.updateSettings(
            controller.settings.copyWith(
              themeMode: m,
            ),
          ),
        );
      }).toList(),
    );
  }

  String _label(AppThemeMode mode) => switch (mode) {
    AppThemeMode.system => LocaleKeys.theme_system.tr(),
    AppThemeMode.light => LocaleKeys.theme_light.tr(),
    AppThemeMode.dark => LocaleKeys.theme_dark.tr(),
    AppThemeMode.pureDark => LocaleKeys.theme_pure_dark.tr(),
  };
}

class _SeedSelector extends WatchingWidget {
  const _SeedSelector();

  @override
  Widget build(BuildContext context) {
    final controller = watchIt<SettingsController>();

    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: AppThemeSeed.values.map((AppThemeSeed seed) {
        final selected = seed == controller.settings.themeSeed;
        final color = seed.color;
        return InkWell(
          onTap: () => controller.updateSettings(
            controller.settings.copyWith(
              themeSeed: seed,
            ),
          ),
          borderRadius: 12.circular,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(
              horizontal: 10,
              vertical: 8,
            ),
            decoration: BoxDecoration(
              borderRadius: 12.circular,
              color: color.withValues(alpha: .12),
              border: Border.all(
                color: selected ? color : color.withValues(alpha: .4),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              spacing: 6,
              children: [
                CircleAvatar(radius: 6, backgroundColor: color),
                Text(seed.label),
                Visibility(
                  visible: selected,
                  child: Icon(Icons.check, size: 14, color: color),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}
