import 'package:flutter/material.dart';
import 'package:injectable/injectable.dart';
import 'package:openquester/src/core/controllers/toast_controller.dart';
import 'package:openquester/src/core/get_it.dart';
import 'package:openquester/src/core/theme.dart';
import 'package:openquester/src/features/package_compress/view/package_compress_screen.dart';

void main() async {
  _initDI();
  runApp(const PackageCompressApp());
}

void _initDI() {
  GetItHelper(getIt).singleton<ToastController>(ToastController.new);
}

class PackageCompressApp extends StatelessWidget {
  const PackageCompressApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Package compressor',
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      debugShowCheckedModeBanner: false,
      home: const PackageCompressScreen(),
    );
  }
}
