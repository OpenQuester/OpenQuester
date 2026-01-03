import 'dart:async';

import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class WaitingForOthersLoader extends StatefulWidget {
  const WaitingForOthersLoader({super.key});

  @override
  State<WaitingForOthersLoader> createState() => _WaitingForOthersLoaderState();
}

class _WaitingForOthersLoaderState extends State<WaitingForOthersLoader> {
  bool showLoader = false;

  @override
  void initState() {
    super.initState();
    _startDelay();
  }

  // Show loader only after a short delay to avoid flickering
  void _startDelay() {
    Timer(const Duration(seconds: 2), () {
      if (!mounted) return;
      setState(() {
        showLoader = true;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!showLoader) return const SizedBox.shrink();

    return Column(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      spacing: 16,
      children: [
        const CircularProgressIndicator(),
        Text(
          LocaleKeys.question_waiting_for_all_players.tr(),
          style: context.textTheme.bodyLarge,
        ),
      ],
    ).paddingAll(16).center().fadeIn();
  }
}
