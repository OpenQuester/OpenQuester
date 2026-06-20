import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class GamePreviewBottom extends StatelessWidget {
  const GamePreviewBottom({required this.game, super.key});
  final GameListItem game;

  @override
  Widget build(BuildContext context) {
    final animationConfiguration = AnimationConfigurationClass.of(context)!;
    return FutureBuilder(
      future: getIt<PackageController>().getPackage(game.package.id),
      builder: (context, snapshot) {
        final pack = snapshot.data;

        return AnimatedSize(
          duration: animationConfiguration.duration,
          child: ListView(
            padding: 16.all,
            shrinkWrap: true,
            children: [
              if (snapshot.connectionState == ConnectionState.waiting)
                const LinearProgressIndicator().paddingBottom(16),
              if (snapshot.hasError)
                Text(
                  LocaleKeys.something_went_wrong.tr(),
                  style: context.textTheme.bodyMedium?.copyWith(
                    color: context.theme.colorScheme.error,
                  ),
                ).paddingBottom(16),
              if (pack != null) PackagePublicOverview(package: pack),
            ],
          ),
        );
      },
    );
  }
}
