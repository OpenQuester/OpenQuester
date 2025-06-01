import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class HiddenBuilder extends StatefulWidget {
  const HiddenBuilder({required this.builder, super.key});
  final Widget Function({required BuildContext context, required bool hidden})
  builder;

  @override
  State<HiddenBuilder> createState() => _HiddenBuilderState();
}

class _HiddenBuilderState extends State<HiddenBuilder> {
  bool hidden = true;
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton(
          onPressed: () => setState(() => hidden = !hidden),
          icon: Icon(hidden ? Icons.visibility_off : Icons.visibility),
        ),
        widget.builder(context: context, hidden: hidden).expand(),
      ],
    );
  }
}
