import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class GamePreviewBottom extends StatelessWidget {
  const GamePreviewBottom({required this.packageId, super.key});
  final int packageId;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: getIt<PackageController>().getPackage(packageId),
      builder: (context, snapshot) {
        final pack = snapshot.data;
        final rounds = pack?.sortedRounds() ?? <PackageRound>[];

        return AnimatedSize(
          duration: AppAnimations.medium,
          curve: AppAnimations.easeOutCubic,
          child: AppAnimatedSwitcher(
            animationType: AppAnimationType.fadeBlur,
            duration: AppAnimations.medium,
            child: snapshot.connectionState == ConnectionState.waiting
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: CircularProgressIndicator(),
                    ),
                  )
                : ListView(
                    shrinkWrap: true,
                    children: [
                      for (final round in rounds)
                        AnimatedListTile(
                          title: Text(round.name),
                          subtitle: Text(
                            round.sortedThemes().map((e) => ' • ${e.name}').join('\n'),
                          ),
                        ),
                    ],
                  ),
          ),
        );
      },
    );
  }
}
