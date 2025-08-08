import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class AdaptiveDialog extends StatefulWidget {
  const AdaptiveDialog({
    required this.builder,
    this.allowBottomSheet = true,
    this.constraints,
    super.key,
  });
  final Widget Function(BuildContext) builder;
  final bool allowBottomSheet;
  final BoxConstraints? constraints;

  @override
  State<AdaptiveDialog> createState() => _AdaptiveDialogState();
}

class _AdaptiveDialogState extends State<AdaptiveDialog>
    with TickerProviderStateMixin {
  @override
  Widget build(BuildContext context) {
    final showDialog =
        !widget.allowBottomSheet || UiModeUtils.wideModeOn(context);

    Widget builder(BuildContext context, ScrollController? scrollController) =>
        GestureDetector(
          child: ListView(
            controller: scrollController,
            shrinkWrap: true,
            children: [widget.builder(context)],
          ),
          onTap: () {
            /* do nothing—this swallows the tap */
          },
        );

    return Material(
      color: Colors.transparent,
      child: GestureDetector(
        onTap: () => Navigator.pop(context),
        child: Scaffold(
          backgroundColor: Colors.transparent,
          body: showDialog
              ? widget.constraints != null
                    ? ConstrainedBox(
                        constraints: widget.constraints!,
                        child: DialogContainer(child: builder(context, null)),
                      ).center()
                    : DialogContainer(child: builder(context, null))
              : Align(
                  alignment: Alignment.bottomCenter,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    spacing: 8,
                    children: [
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [CloseButton()],
                      ).paddingTop(8),
                      builder(context, null).flexible(),
                    ],
                  ),
                ),
        ),
      ),
    );
  }
}
