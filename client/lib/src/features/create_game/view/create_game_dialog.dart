import 'dart:async';

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
      builder: (context) => Card(
        elevation: 0,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header section with title and icon
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
              child: Column(
                children: [
                  Icon(
                    Icons.rocket_launch_rounded,
                    size: 36,
                    color: context.theme.colorScheme.primary,
                  ).paddingBottom(8),
                  Text(
                    LocaleKeys.start_game.tr(),
                    style: context.textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: context.theme.colorScheme.onSurface,
                    ),
                    textAlign: TextAlign.center,
                  ).paddingBottom(4),
                  Text(
                    LocaleKeys.create_game_hint.tr(),
                    style: context.textTheme.bodyMedium?.copyWith(
                      color: context.theme.colorScheme.onSurface.withValues(
                        alpha: 0.7,
                      ),
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
            // Main content
            Form(
              key: controller.formKey,
              child: Column(
                spacing: 20,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Package selection section
                  _PackageSelectionSection(
                    controller: controller,
                    state: state,
                  ),

                  // Game configuration section
                  _GameConfigSection(
                    controller: controller,
                    state: state,
                  ),

                  // Action buttons with better styling
                  _ActionButtons(
                    controller: controller,
                    stateValid: state.valid,
                  ),
                ],
              ),
            ).paddingAll(16),
          ],
        ),
      ),
    );
  }
}

class _MaxPlayersSelect extends StatelessWidget {
  const _MaxPlayersSelect({required this.state, required this.controller});

  final CreateGameDto state;
  final CreateGameController controller;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: 14.all,
      decoration: BoxDecoration(
        color: context.theme.colorScheme.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: context.theme.colorScheme.outline.withValues(alpha: 0.2),
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Icon(
                Icons.group_rounded,
                size: 20,
                color: context.theme.colorScheme.primary,
              ).paddingRight(12),
              Expanded(
                child: Text(
                  LocaleKeys.max_players.tr(),
                  style: context.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              Container(
                padding: 8.horizontal + 4.vertical,
                decoration: BoxDecoration(
                  color: context.theme.colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${state.maxPlayers}',
                  style: context.textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: context.theme.colorScheme.onPrimaryContainer,
                  ),
                ),
              ),
            ],
          ).paddingBottom(8),
          Slider(
            value: state.maxPlayers.toDouble(),
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
      ),
    );
  }
}

class _PrivateGameSelect extends StatelessWidget {
  const _PrivateGameSelect({required this.state, required this.controller});

  final CreateGameDto state;
  final CreateGameController controller;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: 14.all,
      decoration: BoxDecoration(
        color: context.theme.colorScheme.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: context.theme.colorScheme.outline.withValues(alpha: 0.2),
        ),
      ),
      child: Row(
        children: [
          Icon(
            state.private ? Icons.lock_rounded : Icons.public_rounded,
            size: 20,
            color: context.theme.colorScheme.primary,
          ).paddingRight(12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  LocaleKeys.private.tr(),
                  style: context.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  LocaleKeys.private_game_description.tr(),
                  style: context.textTheme.bodySmall?.copyWith(
                    color: context.theme.colorScheme.onSurface.withValues(
                      alpha: 0.7,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: state.private,
            onChanged: (private) =>
                controller.state.value = state.copyWith(private: private),
          ),
        ],
      ),
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
    return Container(
      padding: 14.all,
      decoration: BoxDecoration(
        color: context.theme.colorScheme.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: context.theme.colorScheme.outline.withValues(alpha: 0.2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.family_restroom_rounded,
                size: 20,
                color: context.theme.colorScheme.primary,
              ).paddingRight(12),
              Text(
                LocaleKeys.age_restriction.tr(),
                style: context.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ).paddingBottom(10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final restriction in ageRestrictions)
                ChoiceChip(
                  label: Text(restriction.f()),
                  selected: state.ageRestriction == restriction,
                  onSelected: (_) => controller.state.value = state.copyWith(
                    ageRestriction: restriction,
                  ),
                  showCheckmark: false,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
            ],
          ),
        ],
      ),
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

class _UploadPackageButtons extends StatelessWidget {
  const _UploadPackageButtons({required this.controller, required this.state});

  final CreateGameController controller;
  final CreateGameDto state;

  @override
  Widget build(BuildContext context) {
    return Row(
      spacing: 12,
      children: [
        Expanded(
          child: _AnimatedPackageButton(
            child: _SearchPackageButton(controller: controller, state: state),
          ),
        ),
        Expanded(
          child: _AnimatedPackageButton(
            child: UploadPackageButton(
              afterUpload: (value) =>
                  controller.state.value = state.copyWith(package: value),
            ),
          ),
        ),
      ],
    );
  }
}

class _AnimatedPackageButton extends StatefulWidget {
  const _AnimatedPackageButton({required this.child});

  final Widget child;

  @override
  State<_AnimatedPackageButton> createState() => _AnimatedPackageButtonState();
}

class _AnimatedPackageButtonState extends State<_AnimatedPackageButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 100),
      vsync: this,
    );
    _scaleAnimation =
        Tween<double>(
          begin: 1,
          end: 0.97,
        ).animate(
          CurvedAnimation(
            parent: _controller,
            curve: Curves.easeInOut,
          ),
        );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => _controller.forward(),
      onTapUp: (_) => _controller.reverse(),
      onTapCancel: () => _controller.reverse(),
      child: AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (context, child) {
          return Transform.scale(
            scale: _scaleAnimation.value,
            child: widget.child,
          );
        },
      ),
    );
  }
}

class _SearchPackageButton extends StatelessWidget {
  const _SearchPackageButton({required this.controller, required this.state});

  final CreateGameController controller;
  final CreateGameDto state;

  @override
  Widget build(BuildContext context) {
    final hasPackage = state.package != null;

    return FilledButton.tonalIcon(
      onPressed: () async {
        final package = await showSearch(
          context: context,
          delegate: CreateGamePackageSearch(),
        );
        if (package == null) return;
        controller.state.value = state.copyWith(package: package);
      },
      icon: Icon(hasPackage ? Icons.edit_rounded : Icons.search_rounded),
      label: Text(
        hasPackage ? LocaleKeys.change.tr() : LocaleKeys.select.tr(),
      ),
    );
  }
}

class _PackageSelectionSection extends StatelessWidget {
  const _PackageSelectionSection({
    required this.controller,
    required this.state,
  });

  final CreateGameController controller;
  final CreateGameDto state;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              Icons.library_books_rounded,
              size: 20,
              color: context.theme.colorScheme.primary,
            ).paddingRight(8),
            Text(
              LocaleKeys.game_package.tr(),
              style: context.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ).paddingBottom(12),

        // Show selected package indicator if package is chosen
        if (state.package != null)
          _SelectedPackageIndicator(package: state.package!).paddingBottom(12),

        _UploadPackageButtons(controller: controller, state: state),
      ],
    );
  }
}

class _SelectedPackageIndicator extends StatelessWidget {
  const _SelectedPackageIndicator({required this.package});

  final PackageListItem package;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: 12.all,
      decoration: BoxDecoration(
        color: context.theme.colorScheme.primaryContainer.withValues(
          alpha: 0.4,
        ),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: context.theme.colorScheme.primary.withValues(alpha: 0.3),
          width: 1.5,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: 6.all,
            decoration: BoxDecoration(
              color: context.theme.colorScheme.primary,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Icon(
              Icons.check_rounded,
              size: 16,
              color: context.theme.colorScheme.onPrimary,
            ),
          ).paddingRight(12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  LocaleKeys.selected_package.tr(),
                  style: context.textTheme.labelSmall?.copyWith(
                    color: context.theme.colorScheme.primary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  package.title,
                  style: context.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Text(
            LocaleKeys.ready_to_play.tr(),
            style: context.textTheme.labelMedium?.copyWith(
              color: context.theme.colorScheme.onSurface.withValues(alpha: 0.7),
            ),
          ),
        ],
      ),
    );
  }
}

class _GameConfigSection extends StatelessWidget {
  const _GameConfigSection({
    required this.controller,
    required this.state,
  });

  final CreateGameController controller;
  final CreateGameDto state;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              Icons.settings_rounded,
              size: 20,
              color: context.theme.colorScheme.primary,
            ).paddingRight(8),
            Text(
              LocaleKeys.game_settings.tr(),
              style: context.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ).paddingBottom(16),

        Column(
          spacing: 16,
          children: [
            _GameName(state: state, controller: controller),
            _AgeRestrictionSelect(
              state: state,
              controller: controller,
            ),
            Row(
              children: [
                Expanded(
                  child: _PrivateGameSelect(
                    state: state,
                    controller: controller,
                  ),
                ),
              ],
            ),
            if (state.private)
              _PasswordField(state: state, controller: controller),
            _MaxPlayersSelect(state: state, controller: controller),
          ],
        ),
      ],
    );
  }
}

class _ActionButtons extends StatelessWidget {
  const _ActionButtons({
    required this.controller,
    required this.stateValid,
  });

  final CreateGameController controller;
  final bool stateValid;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: 16.vertical,
      child: LoadingButtonBuilder(
        onPressed: () async {
          await const ProfileDialog().showIfUnauthorized(context);
          if (!context.mounted) return;
          await controller.createGame(context);
        },
        onError: handleError,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.play_arrow_rounded,
              size: 24,
            ).paddingRight(8),
            Text(LocaleKeys.start_game.tr()),
          ],
        ),
        builder: (context, child, onPressed) {
          return _AnimatedButton(
            onPressed: stateValid ? onPressed : null,
            enabled: stateValid,
            child: child,
          );
        },
      ),
    );
  }
}

class _AnimatedButton extends StatefulWidget {
  const _AnimatedButton({
    required this.child,
    required this.onPressed,
    required this.enabled,
  });

  final Widget child;
  final VoidCallback? onPressed;
  final bool enabled;

  @override
  State<_AnimatedButton> createState() => _AnimatedButtonState();
}

class _AnimatedButtonState extends State<_AnimatedButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _scaleAnimation;
  bool _isPressed = false;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 150),
      vsync: this,
    );
    _scaleAnimation =
        Tween<double>(
          begin: 1,
          end: 0.95,
        ).animate(
          CurvedAnimation(
            parent: _animationController,
            curve: Curves.easeInOut,
          ),
        );
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  void _handleTapDown(TapDownDetails details) {
    if (widget.enabled && widget.onPressed != null) {
      setState(() => _isPressed = true);
      unawaited(_animationController.forward());
    }
  }

  void _handleTapUp(TapUpDetails details) {
    if (widget.enabled && _isPressed) {
      setState(() => _isPressed = false);
      unawaited(_animationController.reverse());
      widget.onPressed?.call();
    }
  }

  void _handleTapCancel() {
    if (widget.enabled && _isPressed) {
      setState(() => _isPressed = false);
      unawaited(_animationController.reverse());
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: widget.enabled ? _handleTapDown : null,
      onTapUp: widget.enabled ? _handleTapUp : null,
      onTapCancel: widget.enabled ? _handleTapCancel : null,
      child: AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (context, child) {
          return Transform.scale(
            scale: widget.enabled ? _scaleAnimation.value : 1.0,
            child: Container(
              padding: 16.horizontal + 12.vertical,
              decoration: BoxDecoration(
                color: widget.enabled
                    ? context.theme.colorScheme.primary
                    : context.theme.colorScheme.onSurface.withValues(
                        alpha: 0.12,
                      ),
                borderRadius: BorderRadius.circular(12),
                boxShadow: widget.enabled
                    ? [
                        BoxShadow(
                          color: context.theme.colorScheme.primary.withValues(
                            alpha: 0.3,
                          ),
                          blurRadius: 4,
                          offset: const Offset(0, 2),
                        ),
                      ]
                    : null,
              ),
              child: Center(
                child: DefaultTextStyle(
                  style: TextStyle(
                    color: widget.enabled
                        ? context.theme.colorScheme.onPrimary
                        : context.theme.colorScheme.onSurface.withValues(
                            alpha: 0.38,
                          ),
                    fontWeight: FontWeight.w500,
                    fontSize: 16,
                  ),
                  child: IconTheme(
                    data: IconThemeData(
                      color: widget.enabled
                          ? context.theme.colorScheme.onPrimary
                          : context.theme.colorScheme.onSurface.withValues(
                              alpha: 0.38,
                            ),
                      size: 24,
                    ),
                    child: widget.child,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _PasswordField extends StatefulWidget {
  const _PasswordField({required this.state, required this.controller});

  final CreateGameDto state;
  final CreateGameController controller;

  @override
  State<_PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<_PasswordField> {
  bool _obscurePassword = true;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      child: TextFormField(
        initialValue: widget.state.password,
        onChanged: (value) => widget.controller.state.value = widget.state
            .copyWith(password: value.isEmpty ? null : value),
        obscureText: _obscurePassword,
        decoration: InputDecoration(
          labelText: LocaleKeys.password_optional.tr(),
          hintText: LocaleKeys.password_hint.tr(),
          prefixIcon: const Icon(Icons.lock_outline_rounded),
          suffixIcon: IconButton(
            icon: Icon(
              _obscurePassword
                  ? Icons.visibility_outlined
                  : Icons.visibility_off_outlined,
            ),
            onPressed: () =>
                setState(() => _obscurePassword = !_obscurePassword),
            tooltip: _obscurePassword
                ? LocaleKeys.show_password.tr()
                : LocaleKeys.hide_password.tr(),
          ),
        ),
        validator: (value) {
          if (value == null || value.isEmpty) return null;
          if (value.length > GameValidationConst.maxPasswordLength) {
            return LocaleKeys.min_length_error.tr(
              args: [GameValidationConst.maxPasswordLength.toString()],
            );
          }
          if (!GameValidationConst.passwordRegExp.hasMatch(value)) {
            return LocaleKeys.password_validation.tr();
          }
          return null;
        },
        maxLength: GameValidationConst.maxPasswordLength,
      ),
    );
  }
}
