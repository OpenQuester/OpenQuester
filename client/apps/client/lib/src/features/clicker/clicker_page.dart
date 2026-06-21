import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';

@RoutePage()
class ClickerPage extends StatefulWidget {
  const ClickerPage({super.key});
  @override
  State<ClickerPage> createState() => _ClickerPageState();
}

class _ClickerPageState extends State<ClickerPage> {
  int _counter = 0;
  bool allowHack = false;

  @override
  void initState() {
    super.initState();
  }

  void _incrementCounter() {
    setState(() {
      _counter++;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: GestureDetector(
          onLongPressStart: (_) => allowHack = true,
          onLongPressEnd: (_) => allowHack = false,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              const Text('You have pushed the button this many times:'),
              Text(
                '$_counter',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
            ],
          ),
        ),
      ),
      floatingActionButton: GestureDetector(
        onHorizontalDragEnd: (_) {
          if (!allowHack) return;
          setState(() {
            _counter *= 10000;
          });
        },
        onTap: _incrementCounter,
        child: FloatingActionButton(
          onPressed: _incrementCounter,
          tooltip: 'Increment',
          child: const Icon(Icons.add),
        ),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
    );
  }
}
