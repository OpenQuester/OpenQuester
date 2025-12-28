import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class ProfileBtn extends StatelessWidget {
  const ProfileBtn({required this.wideMode, super.key});
  final bool wideMode;

  @override
  Widget build(BuildContext context) {
    if (wideMode) {
      return FloatingActionButton.extended(
        heroTag: 'profile',
        onPressed: () => const ProfileDialog().show(context),
        label: Text(LocaleKeys.profile.tr()),
        icon: const Icon(Icons.account_circle),
      );
    }

    return FloatingActionButton.small(
      heroTag: 'profile',
      onPressed: () => const ProfileDialog().show(context),
      tooltip: LocaleKeys.profile.tr(),
      child: const Icon(Icons.account_circle),
    );
  }
}
