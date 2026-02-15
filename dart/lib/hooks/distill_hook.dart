import 'dart:convert';
import 'dart:io';
import '../extractor/extractor.dart';
import '../store/metadata.dart';
import '../store/vector.dart';
import '../store/scope.dart';
import '../store/types.dart';

/// Distill hook handler for PreCompact and SessionEnd events.
///
/// Receives hook event data via stdin (JSON), extracts knowledge
/// from the session transcript, and stores it.
///
/// Usage: echo '{"session_id":"...","transcript_path":"..."}' | dart run distill_hook.dart
Future<void> runHook() async {
  // Read stdin
  final input = await _readStdin();
  if (input.isEmpty) {
    stderr.writeln('distill-hook: no input received on stdin');
    exit(1);
  }

  Map<String, dynamic> hookData;
  try {
    hookData = jsonDecode(input) as Map<String, dynamic>;
  } catch (_) {
    stderr.writeln('distill-hook: invalid JSON on stdin');
    exit(1);
  }

  final sessionId = hookData['session_id'] as String?;
  final transcriptPath = hookData['transcript_path'] as String?;

  if (sessionId == null || transcriptPath == null) {
    stderr.writeln('distill-hook: missing session_id or transcript_path');
    exit(1);
  }

  // Determine trigger type from hook event name
  final hookEventName = hookData['hook_event_name'] as String?;
  final trigger = hookEventName == 'PreCompact'
      ? ExtractionTrigger.preCompact
      : ExtractionTrigger.sessionEnd;

  final cwd = hookData['cwd'] as String?;
  final projectRoot =
      cwd != null ? detectProjectRoot(cwd: cwd) : detectProjectRoot();
  final projectName = projectRoot?.split('/').last;

  stderr.writeln(
    'distill-hook: extracting from session $sessionId (${trigger.value})',
  );

  try {
    final chunks = await extractKnowledge(
      transcriptPath: transcriptPath,
      sessionId: sessionId,
      trigger: trigger,
      projectName: projectName,
    );

    if (chunks.isEmpty) {
      stderr.writeln('distill-hook: no knowledge extracted');
      return;
    }

    var saved = 0;
    for (final chunk in chunks) {
      try {
        final meta = MetadataStore(chunk.scope, projectRoot: projectRoot);
        final vector = VectorStore(chunk.scope, projectRoot: projectRoot);

        final inserted = meta.insert(chunk);
        vector.index(inserted.id, inserted.content, inserted.tags);

        meta.close();
        vector.close();
        saved++;
      } catch (err) {
        stderr.writeln('distill-hook: failed to save chunk: $err');
      }
    }

    stderr.writeln(
      'distill-hook: extracted ${chunks.length}, saved $saved knowledge chunks',
    );
  } catch (err) {
    stderr.writeln('distill-hook: extraction failed: $err');
    exit(1);
  }
}

Future<String> _readStdin() async {
  final buffer = StringBuffer();
  try {
    await for (final chunk in stdin.transform(utf8.decoder)) {
      buffer.write(chunk);
    }
  } catch (_) {
    // stdin closed or errored
  }
  return buffer.toString().trim();
}
