import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class PackageCompressScreen extends StatelessWidget {
  const PackageCompressScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: LoadingButtonBuilder(
        onPressed: PackageCompressController.pickAndCompress,
        onError: handleError,
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
