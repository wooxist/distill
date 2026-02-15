import 'dart:io';
import 'package:path/path.dart' as p;
import 'types.dart';

final String _globalDir =
    p.join(Platform.environment['HOME'] ?? '', '.distill', 'knowledge');
const String _projectSubdir = '.distill';

/// Resolve the storage directory for a given scope.
String resolveStorePath(KnowledgeScope scope, {String? projectRoot}) {
  if (scope == KnowledgeScope.global) {
    _ensureDir(_globalDir);
    return _globalDir;
  }

  if (projectRoot == null) {
    throw ArgumentError('project scope requires projectRoot');
  }

  final dir = p.join(projectRoot, _projectSubdir, 'knowledge');
  _ensureDir(dir);
  return dir;
}

/// Get the SQLite database path for a scope.
String resolveDbPath(KnowledgeScope scope, {String? projectRoot}) {
  final base = resolveStorePath(scope, projectRoot: projectRoot);
  return p.join(base, 'metadata.db');
}

/// Detect project root from CWD by looking for common markers.
String? detectProjectRoot({String? cwd}) {
  final dir = cwd ?? Directory.current.path;
  const markers = ['.git', 'pubspec.yaml', 'package.json', 'CLAUDE.md'];

  for (final marker in markers) {
    if (FileSystemEntity.typeSync(p.join(dir, marker)) !=
        FileSystemEntityType.notFound) {
      return dir;
    }
  }
  return null;
}

void _ensureDir(String dir) {
  final d = Directory(dir);
  if (!d.existsSync()) {
    d.createSync(recursive: true);
  }
}
