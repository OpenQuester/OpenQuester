import 'package:flutter/material.dart';
import 'package:nb_utils/nb_utils.dart';
import 'package:openquester/src/core/ui/components/loading_button_builder.dart';
import 'package:openquester/src/features/package_compress/controllers/package_compress_controller.dart';

class PackageCompressScreen extends StatelessWidget {
  const PackageCompressScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: LoadingButtonBuilder(
        onPressed: PackageCompressController.pickAndCompress,
        child: const Icon(Icons.upload_file),
        builder: (context, child, onPressed) {
          return FilledButton.icon(
            onPressed: onPressed,
            label: const Text('Pick package and compress'),
            icon: child,
          );
        },
      ).center(),
    );
  }
}
