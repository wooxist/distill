import 'dart:io';
import 'package:mcp_dart/mcp_dart.dart';
import 'package:distill/server.dart';

Future<void> main() async {
  try {
    final server = createServer();
    final transport = StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    stderr.writeln('Distill server error: $error');
    exit(1);
  }
}
