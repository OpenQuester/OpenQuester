import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

@RoutePage(deferredLoading: false)
class CreateGameDialog extends WatchingWidget {
  const CreateGameDialog({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = createOnce(
      CreateGameController.new,
      dispose: (e) => e.dispose(),
    );

    final state = watch(controller.state).value;

    return AdaptiveDialog(
      builder: (context) => AnimatedCard(
        elevation: 0,
        padding: const EdgeInsets.all(24),
        enableHoverEffect: false,
        enableTapAnimation: false,
        child: SingleChildScrollView(
          child: Form(
            key: controller.formKey,
            child: Column(
              spacing: 20,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header
                Text(
                  LocaleKeys.create_game.tr(),
                  style: context.textTheme.headlineMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                
                _UploadPackageButtons(controller: controller, state: state),
                _SelectedPackagePreview(package: state.package),
                
                // Game Settings Section
                AnimatedCard(
                  backgroundColor: Theme.of(context).colorScheme.surfaceContainerLow,
                  padding: const EdgeInsets.all(16),
                  enableHoverEffect: false,
                  enableTapAnimation: false,
                  child: Column(
                    spacing: 16,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        LocaleKeys.game_settings.tr(),
                        style: context.textTheme.titleMedium,
                      ),
                      _GameName(state: state, controller: controller),
                      _AgeRestrictionSelect(
                        state: state,
                        controller: controller,
                      ).withTitle(LocaleKeys.age_restriction.tr()),
                      _PrivateGameSelect(state: state, controller: controller),
                      _MaxPlayersSelect(state: state, controller: controller),
                    ],
                  ),
                ),
                
                _StartGameButton(
                  controller: controller,
                  stateValid: state.valid,
                ).paddingTop(24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StartGameButton extends StatelessWidget {
  const _StartGameButton({required this.controller, required this.stateValid});

  final CreateGameController controller;
  final bool stateValid;

  @override
  Widget build(BuildContext context) {
    return LoadingButtonBuilder(
      onPressed: () => controller.createGame(context),
      child: const Icon(Icons.play_arrow_outlined),
      builder: (context, child, onPressed) {
        return FilledButton.icon(
          onPressed: stateValid ? onPressed : null,
          icon: child,
          label: Text(LocaleKeys.start_game.tr()),
          style: ButtonStyle(padding: WidgetStatePropertyAll(16.all)),
        );
      },
    );
  }
}

class _MaxPlayersSelect extends StatelessWidget {
  const _MaxPlayersSelect({required this.state, required this.controller});

  final CreateGameDto state;
  final CreateGameController controller;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          spacing: 8,
          children: [
            Text(
              LocaleKeys.max_players.tr(),
              style: context.textTheme.bodyLarge,
            ),
            Text('${state.maxPlayers}', style: context.textTheme.bodyLarge),
          ],
        ),
        Slider(
          value: state.maxPlayers.toDouble(),
          padding: 16.horizontal,
          divisions:
              GameValidationConst.maxMaxPlayers -
              GameValidationConst.minMaxPlayers,
          onChanged: (maxPlayers) => controller.state.value = state.copyWith(
            maxPlayers: maxPlayers.toInt(),
          ),
          min: GameValidationConst.minMaxPlayers.toDouble(),
          max: GameValidationConst.maxMaxPlayers.toDouble(),
        ),
      ],
    );
  }
}

class _PrivateGameSelect extends StatelessWidget {
  const _PrivateGameSelect({required this.state, required this.controller});

  final CreateGameDto state;
  final CreateGameController controller;

  @override
  Widget build(BuildContext context) {
    return AnimatedListTile(
      title: Text(LocaleKeys.private.tr()),
      subtitle: Text(LocaleKeys.private_game_description.tr()),
      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      isSelected: state.private,
      trailing: Switch(
        value: state.private,
        onChanged: (private) =>
            controller.state.value = state.copyWith(private: private),
      ),
      onTap: () => controller.state.value = state.copyWith(private: !state.private),
    );
  }
}

class _AgeRestrictionSelect extends StatelessWidget {
  const _AgeRestrictionSelect({required this.state, required this.controller});

  final CreateGameDto state;
  final CreateGameController controller;

  @override
  Widget build(BuildContext context) {
    final ageRestrictions = AgeRestriction.values
        .whereNot((e) => e == AgeRestriction.$unknown)
        .toList()
        .reversed;
    return Wrap(
      spacing: 4,
      runSpacing: 4,
      children: [
        for (final restriction in ageRestrictions)
          ChoiceChip(
            label: Text(restriction.f()),
            selected: state.ageRestriction == restriction,
            onSelected: (_) => controller.state.value = state.copyWith(
              ageRestriction: restriction,
            ),
            showCheckmark: false,
          ),
      ],
    );
  }
}

class _GameName extends StatelessWidget {
  const _GameName({required this.state, required this.controller});

  final CreateGameDto state;
  final CreateGameController controller;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      initialValue: state.gameName,
      onChanged: (value) =>
          controller.state.value = state.copyWith(gameName: value),
      decoration: InputDecoration(labelText: LocaleKeys.game_name.tr()),
      validator: (value) {
        final lenght = value?.length ?? 0;
        if (lenght < GameValidationConst.minGameNameLength) {
          return LocaleKeys.min_length_error.tr(
            args: [GameValidationConst.minGameNameLength.toString()],
          );
        }
        if (!GameValidationConst.gameNameRegExp.hasMatch(value ?? '')) {
          return LocaleKeys.game_name_regex_error.tr();
        }
        return null;
      },
      maxLength: GameValidationConst.maxGameNameLength,
    );
  }
}

class _SelectedPackagePreview extends StatelessWidget {
  const _SelectedPackagePreview({required this.package});

  final PackageListItem? package;

  @override
  Widget build(BuildContext context) {
    return AppAnimatedSwitcher(
      animationType: AppAnimationType.slideScale,
      duration: AppAnimations.medium,
      child: package != null
          ? AnimatedCard(
              key: ValueKey(package!.id),
              backgroundColor: Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.1),
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.symmetric(vertical: 8),
              child: PackageListItemWidget(item: package!),
            )
          : const SizedBox.shrink(),
    );
  }
}

class _UploadPackageButtons extends StatelessWidget {
  const _UploadPackageButtons({required this.controller, required this.state});

  final CreateGameController controller;
  final CreateGameDto state;

  @override
  Widget build(BuildContext context) {
    return Row(
      spacing: 16,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _SearchPackageButton(controller: controller, state: state).flexible(),
        UploadPackageButton(
          afterUpload: (value) =>
              controller.state.value = state.copyWith(package: value),
        ).flexible(),
      ],
    );
  }
}

class _SearchPackageButton extends StatelessWidget {
  const _SearchPackageButton({required this.controller, required this.state});

  final CreateGameController controller;
  final CreateGameDto state;

  @override
  Widget build(BuildContext context) {
    return FilledButton.tonalIcon(
      onPressed: () async {
        final package = await showSearch(
          context: context,
          delegate: CreateGamePackageSearch(),
        );
        if (package == null) return;
        controller.state.value = state.copyWith(package: package);
      },
      icon: Icon(state.package == null ? Icons.add : Icons.edit),
      label: Text(LocaleKeys.select_game_package.tr()),
    );
  }
}
