import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class ProfileBtn extends StatelessWidget {
  const ProfileBtn({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.account_circle),
      tooltip: LocaleKeys.profile.tr(),
      onPressed: () => const ProfileDialog().show(context),
    );
  }
}
