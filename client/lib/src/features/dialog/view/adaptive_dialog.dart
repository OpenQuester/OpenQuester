import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class AdaptiveDialog extends StatefulWidget {
  const AdaptiveDialog({
    required this.builder,
    this.allowBottomSheet = true,
    this.constraints,
    this.useScrollView = true,
    super.key,
  });
  final Widget Function(BuildContext) builder;
  final bool allowBottomSheet;
  final BoxConstraints? constraints;
  final bool useScrollView;

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
          // do nothing to swallows the tap
          onTap: () {},
          child: widget.useScrollView
              ? ListView(
                  controller: scrollController,
                  shrinkWrap: true,
                  children: [widget.builder(context)],
                )
              : widget.builder(context),
        );

    return Material(
      color: Colors.transparent,
      child: GestureDetector(
        onTap: () => Navigator.pop(context),
        child: SafeArea(
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
      ),
    );
  }
}
