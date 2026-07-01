import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class AdaptiveDialog extends StatefulWidget {
  const AdaptiveDialog({
    required this.builder,
    this.allowBottomSheet = true,
    this.constraints,
    this.maxWidth,
    this.useScrollView = true,
    this.useSafeArea = true,
    super.key,
  });
  final Widget Function(BuildContext) builder;
  final bool allowBottomSheet;
  final bool useSafeArea;
  final BoxConstraints? constraints;
  final bool useScrollView;
  final double? maxWidth;

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
                  padding: screenBottomInset(context).bottom,
                  controller: scrollController,
                  shrinkWrap: true,
                  children: [widget.builder(context)],
                )
              : widget.builder(context),
        );

    final maxWidth = widget.maxWidth ?? UiModeUtils.maximumDialogWidth(context);

    Widget child = Scaffold(
      backgroundColor: Colors.transparent,
      body: showDialog
          ? widget.constraints != null
                ? ConstrainedBox(
                    constraints: widget.constraints!,
                    child: DialogContainer(
                      maxWidth: maxWidth,
                      useSafeArea: widget.useSafeArea,
                      child: builder(context, null),
                    ),
                  ).center()
                : DialogContainer(
                    maxWidth: maxWidth,
                    useSafeArea: widget.useSafeArea,
                    child: builder(context, null),
                  )
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
    );

    // Use SafeArea only when not using scroll view,
    // otherwise the ListView will handle the insets automatically
    if (widget.useSafeArea) {
      child = SafeArea(
        bottom: !widget.useScrollView,
        child: child,
      );
    }

    return Material(
      color: Colors.transparent,
      child: GestureDetector(
        onTap: () => Navigator.pop(context),
        child: child,
      ),
    );
  }
}
