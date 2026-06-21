import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class GamePreviewBottom extends StatelessWidget {
  const GamePreviewBottom({required this.packageId, super.key});
  final int packageId;

  @override
  Widget build(BuildContext context) {
    final animationConfiguration = AnimationConfigurationClass.of(context)!;
    return FutureBuilder(
      future: getIt<PackageController>().getPackage(packageId),
      builder: (context, snapshot) {
        final pack = snapshot.data;
        final rounds = pack?.sortedRounds() ?? <PackageRound>[];

        return AnimatedSize(
          duration: animationConfiguration.duration,
          child: ListView(
            shrinkWrap: true,
            children: [
              for (final round in rounds)
                ListTile(
                  title: Text(round.name),
                  subtitle: Text(
                    round.sortedThemes().map((e) => ' • ${e.name}').join('\n'),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
