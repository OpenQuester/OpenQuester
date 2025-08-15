import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:openquester/common_imports.dart';
import 'package:siq_file/siq_file.dart';

class FileOpening extends StatefulWidget {
  const FileOpening({super.key});

  @override
  State<FileOpening> createState() => _FileOpeningState();
}

class _FileOpeningState extends State<FileOpening> {
  PackageCreateInputData? siqFile;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(child: Text('Pack name: ${siqFile?.title}')),
            Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.file_open),
                  onPressed: _openFile,
                ),
                IconButton(
                  icon: const Icon(Icons.copy),
                  onPressed: siqFile == null
                      ? null
                      : () async => Clipboard.setData(
                          ClipboardData(text: jsonEncode(siqFile?.toJson())),
                        ),
                ),
                const IconButton(
                  icon: Icon(Icons.upload_file),
                  onPressed: null,
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }

  Future<void> _openFile() async {
    var now = DateTime.now();

    final pickedTime = DateTime.now().difference(now);
    now = DateTime.now();

    final result = await FileService.pickFile();
    final file = result?.files.first;
    if (file == null) return;

    final parser = SiqArchiveParser();
    await parser.load(await file.xFile.readAsBytes());
    siqFile = await parser.parse();
    setState(() {});

    final parseTime = DateTime.now().difference(now);

    final debugText =
        '''
    parseTime: $parseTime;
    pickedTime: $pickedTime;
    rounds: ${siqFile?.rounds.length}''';
    
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(debugText)));
  }
}
