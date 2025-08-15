import 'dart:async';

import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class LoadingButtonBuilder extends StatefulWidget {
  const LoadingButtonBuilder({
    required this.onPressed,
    required this.child,
    required this.builder,
    super.key,
  });
  final Future<void> Function()? onPressed;
  final Widget child;
  final Widget Function(
    BuildContext context,
    Widget child,
    Future<void> Function()? onPressed,
  )
  builder;

  @override
  State<LoadingButtonBuilder> createState() => _LoadingButtonBuilderState();
}

class _LoadingButtonBuilderState extends State<LoadingButtonBuilder> {
  bool loading = false;

  @override
  Widget build(BuildContext context) {
    final loader = Container(
      decoration: BoxDecoration(
        color: context.theme.colorScheme.onSecondary,
        shape: BoxShape.circle,
      ),
      padding: 4.all,
      margin: 4.all,
      child: CircularProgressIndicator(
        valueColor: AlwaysStoppedAnimation(context.theme.colorScheme.secondary),
        constraints: BoxConstraints.tight(const Size.square(18)),
        strokeWidth: 2,
      ),
    );

    Future<void> onPressed(
      void Function(void Function()) setState,
      Future<void> Function()? onPressed,
    ) async {
      setState(() => loading = true);
      try {
        await onPressed?.call();
      } catch (e) {
        logger.w(e);
        await getIt<ToastController>().show(e);
      } finally {
        if (context.mounted) setState(() => loading = false);
      }
    }

    return widget.builder(
      context,
      loading ? loader : widget.child,
      widget.onPressed == null
          ? null
          : () async => onPressed(setState, widget.onPressed),
    );
  }
}
