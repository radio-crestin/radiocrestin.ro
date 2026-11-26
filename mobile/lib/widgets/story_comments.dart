import 'dart:async';

import 'package:flutter/material.dart';

import '../services/stories_service.dart';
import '../services/story.dart';
import '../theme.dart';
import 'story_overlay.dart' show isCompactStory, formatStoryCount;

/// When a comment was written, as a listener says it: `acum`, `acum 5 min`,
/// `acum 3 h`, `ieri`, `acum 4 zile`, or the date.
String storyCommentAge(DateTime at, {DateTime? now}) {
  final age = (now ?? DateTime.now()).difference(at);
  if (age.inMinutes < 1) return 'acum';
  if (age.inHours < 1) return 'acum ${age.inMinutes} min';
  if (age.inDays < 1) return 'acum ${age.inHours} h';
  if (age.inDays == 1) return 'ieri';
  if (age.inDays < 7) return 'acum ${age.inDays} zile';
  return '${at.day}.${at.month.toString().padLeft(2, '0')}.${at.year}';
}

/// What the field says after a comment was sent.
String _say(StoryCommentResult result) => switch (result) {
      StoryCommentResult.posted => 'Comentariu publicat',
      StoryCommentResult.tooMany =>
        'Ai trimis multe comentarii. Încearcă peste un minut.',
      StoryCommentResult.failed =>
        'Nu s-a publicat. Verifică internetul și încearcă din nou.',
    };

/// The field for a public comment: a globe and the admin's placeholder say
/// it is public; while it is being written, a line above it says who will
/// see it and under which name, which the listener can change.
class StoryCommentField extends StatefulWidget {
  const StoryCommentField({
    super.key,
    required this.hint,
    required this.service,
    required this.focusNode,
    required this.onSend,
  });

  final String hint;
  final StoriesService service;
  final FocusNode focusNode;

  /// Posts the text, and says how it went.
  final Future<StoryCommentResult> Function(String text) onSend;

  @override
  State<StoryCommentField> createState() => _StoryCommentFieldState();
}

class _StoryCommentFieldState extends State<StoryCommentField> {
  final TextEditingController _text = TextEditingController();
  bool _sending = false;
  StoryCommentResult? _result;
  Timer? _resultTimer;

  @override
  void initState() {
    super.initState();
    _text.addListener(() => setState(() {}));
    widget.focusNode.addListener(_onFocus);
  }

  void _onFocus() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    widget.focusNode.removeListener(_onFocus);
    _text.dispose();
    _resultTimer?.cancel();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _text.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    final result = await widget.onSend(text);
    if (!mounted) return;
    setState(() {
      _sending = false;
      _result = result;
    });
    _resultTimer?.cancel();
    _resultTimer = Timer(const Duration(milliseconds: 2800), () {
      if (mounted) setState(() => _result = null);
    });
    if (result == StoryCommentResult.posted) {
      _text.clear();
      widget.focusNode.unfocus();
    }
  }

  Future<void> _changeName() async {
    await StoryCommentName.edit(context, widget.service);
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;
    final writing = widget.focusNode.hasFocus;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AnimatedSize(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeInOut,
          alignment: Alignment.bottomLeft,
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            child: result != null
                ? Padding(
                    key: ValueKey(result),
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _StatusChip(
                      text: _say(result),
                      ok: result == StoryCommentResult.posted,
                    ),
                  )
                : writing
                    ? Padding(
                        key: const ValueKey('public-notice'),
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _PublicNotice(
                          name: widget.service.commentName,
                          onChangeName: _changeName,
                        ),
                      )
                    : const SizedBox(width: double.infinity),
          ),
        ),
        _field(),
      ],
    );
  }

  Widget _field() {
    final hasText = _text.text.trim().isNotEmpty;
    return Container(
      height: isCompactStory(context) ? 42 : 48,
      padding: const EdgeInsets.only(left: 12, right: 4),
      decoration: BoxDecoration(
        color: const Color(0x33000000),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.45)),
      ),
      child: Row(
        children: [
          // The globe says it at a glance: what is written here is public.
          const Icon(Icons.public_rounded, color: Colors.white, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              key: const ValueKey('story-comment-field'),
              controller: _text,
              focusNode: widget.focusNode,
              maxLength: StoriesService.maxCommentLength,
              textInputAction: TextInputAction.send,
              textCapitalization: TextCapitalization.sentences,
              onSubmitted: (_) => _send(),
              cursorColor: Colors.white,
              style: const TextStyle(color: Colors.white, fontSize: 15),
              decoration: InputDecoration(
                hintText: widget.hint,
                hintStyle: TextStyle(
                    color: Colors.white.withValues(alpha: 0.8), fontSize: 15),
                border: InputBorder.none,
                counterText: '',
                isDense: true,
              ),
            ),
          ),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 150),
            child: _sending
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2.5, color: Colors.white),
                    ),
                  )
                : hasText
                    ? TextButton(
                        key: const ValueKey('story-comment-send'),
                        onPressed: _send,
                        style: TextButton.styleFrom(
                            foregroundColor: Colors.white),
                        child: const Text('Publică',
                            style: TextStyle(fontWeight: FontWeight.w700)),
                      )
                    : const SizedBox(width: 12, height: 48),
          ),
        ],
      ),
    );
  }
}

/// "Public: every listener sees it, signed «Ana»", with a way to change
/// the name.
class _PublicNotice extends StatelessWidget {
  const _PublicNotice({required this.name, required this.onChangeName});

  final String? name;
  final VoidCallback onChangeName;

  @override
  Widget build(BuildContext context) {
    final signed = name ?? StoryComment.anonymousName;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 6, 6, 6),
      decoration: BoxDecoration(
        color: const Color(0xCC000000),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.public_rounded, color: Colors.white70, size: 16),
          const SizedBox(width: 6),
          Flexible(
            child: Text.rich(
              TextSpan(children: [
                const TextSpan(
                  text: 'Comentariu public',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                TextSpan(text: ' · îl văd toți ascultătorii, semnat „$signed”'),
              ]),
              key: const ValueKey('story-comment-public'),
              style: const TextStyle(color: Colors.white, fontSize: 12.5),
            ),
          ),
          TextButton(
            key: const ValueKey('story-comment-name'),
            onPressed: onChangeName,
            style: TextButton.styleFrom(
              foregroundColor: AppColors.primaryLight,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              minimumSize: const Size(0, 32),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: const Text('Schimbă',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
          ),
        ],
      ),
    );
  }
}

/// The name a listener signs comments with, asked in a small dialog.
class StoryCommentName extends StatefulWidget {
  const StoryCommentName({super.key, required this.initial});

  final String? initial;

  static Future<void> edit(BuildContext context, StoriesService service) async {
    final name = await showDialog<String>(
      context: context,
      builder: (context) => StoryCommentName(initial: service.commentName),
    );
    if (name != null) await service.saveCommentName(name);
  }

  @override
  State<StoryCommentName> createState() => _StoryCommentNameState();
}

class _StoryCommentNameState extends State<StoryCommentName> {
  // Owned here: the dialog still builds its field while it animates out.
  late final TextEditingController _name =
      TextEditingController(text: widget.initial ?? '');

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Numele sub comentarii'),
      content: TextField(
        key: const ValueKey('story-comment-name-field'),
        controller: _name,
        autofocus: true,
        maxLength: StoriesService.maxNameLength,
        textCapitalization: TextCapitalization.words,
        decoration: const InputDecoration(
          hintText: StoryComment.anonymousName,
          helperText: 'Gol: „Ascultător”. Îl văd toți cei care citesc.',
        ),
        onSubmitted: (value) => Navigator.of(context).pop(value),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Renunță'),
        ),
        FilledButton(
          key: const ValueKey('story-comment-name-save'),
          onPressed: () => Navigator.of(context).pop(_name.text),
          child: const Text('Salvează'),
        ),
      ],
    );
  }
}

/// A story's public comments in a sheet over the viewer, newest first,
/// with older ones as the listener scrolls, and the field to add one.
class StoryCommentsSheet extends StatefulWidget {
  const StoryCommentsSheet({
    super.key,
    required this.story,
    required this.slide,
    required this.service,
  });

  final Story story;
  final StorySlide slide;
  final StoriesService service;

  static Future<void> show(
    BuildContext context, {
    required Story story,
    required StorySlide slide,
    required StoriesService service,
  }) =>
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: const Color(0xFF1B1B1D),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
        ),
        builder: (context) => StoryCommentsSheet(
            story: story, slide: slide, service: service),
      );

  @override
  State<StoryCommentsSheet> createState() => _StoryCommentsSheetState();
}

class _StoryCommentsSheetState extends State<StoryCommentsSheet> {
  final List<StoryComment> _comments = [];
  final FocusNode _focus = FocusNode();
  final ScrollController _scroll = ScrollController();
  String? _nextBefore;
  bool _loading = true;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    unawaited(_load());
  }

  @override
  void dispose() {
    _focus.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_nextBefore != null &&
        !_loading &&
        _scroll.position.extentAfter < 300) {
      unawaited(_load(before: _nextBefore));
    }
  }

  Future<void> _load({String? before}) async {
    setState(() {
      _loading = true;
      _failed = false;
    });
    final page =
        await widget.service.fetchComments(widget.story, before: before);
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (page == null) {
        _failed = true;
        return;
      }
      if (before == null) _comments.clear();
      _comments.addAll(page.comments);
      _nextBefore = page.nextBefore;
    });
  }

  Future<StoryCommentResult> _post(String text) async {
    final (result, comment) = await widget.service
        .postComment(widget.story, widget.slide, text);
    if (comment != null && mounted) {
      setState(() => _comments.insert(0, comment));
      if (_scroll.hasClients) _scroll.jumpTo(0);
    }
    return result;
  }

  Future<void> _delete(StoryComment comment) async {
    final ok = await widget.service.deleteComment(widget.story, comment);
    if (!mounted) return;
    if (ok) {
      setState(() => _comments.removeWhere((c) => c.id == comment.id));
    } else {
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(const SnackBar(
          content: Text('Comentariul nu a putut fi șters. Încearcă din nou.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    final height = MediaQuery.sizeOf(context).height;
    return Padding(
      padding: EdgeInsets.only(bottom: keyboard),
      child: SizedBox(
        height: height * 0.7,
        child: Column(
          children: [
            const SizedBox(height: 8),
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: StreamBuilder<Map<String, int>>(
                stream: widget.service.commentCounts,
                builder: (context, _) {
                  final count = widget.service.commentCountOf(widget.story);
                  return Text(
                    count > 0
                        ? 'Comentarii · ${formatStoryCount(count)}'
                        : 'Comentarii',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w700),
                  );
                },
              ),
            ),
            const Divider(height: 1, color: Colors.white12),
            Expanded(child: _list()),
            const Divider(height: 1, color: Colors.white12),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                child: StoryCommentField(
                  hint: widget.story.comments.hint,
                  service: widget.service,
                  focusNode: _focus,
                  onSend: _post,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _list() {
    if (_comments.isEmpty) {
      final text = _loading
          ? null
          : _failed
              ? 'Comentariile nu s-au putut încărca.'
              : 'Încă nu sunt comentarii. Scrie tu primul!';
      return Center(
        child: text == null
            ? const SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(
                    strokeWidth: 2.5, color: AppColors.primary),
              )
            : Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(text, style: const TextStyle(color: Colors.white70)),
                  if (_failed)
                    TextButton(
                      onPressed: _load,
                      child: const Text('Încearcă din nou'),
                    ),
                ],
              ),
      );
    }
    return ListView.builder(
      key: const ValueKey('story-comments-list'),
      controller: _scroll,
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: _comments.length + (_nextBefore != null ? 1 : 0),
      itemBuilder: (context, index) {
        if (index >= _comments.length) {
          return const Padding(
            padding: EdgeInsets.all(16),
            child: Center(
              child: SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                    strokeWidth: 2.5, color: AppColors.primary),
              ),
            ),
          );
        }
        final comment = _comments[index];
        return _CommentTile(
          comment: comment,
          onDelete: comment.mine ? () => _delete(comment) : null,
        );
      },
    );
  }
}

class _CommentTile extends StatelessWidget {
  const _CommentTile({required this.comment, this.onDelete});

  final StoryComment comment;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final initial = comment.authorName.isEmpty
        ? '?'
        : comment.authorName.characters.first.toUpperCase();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 4, 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: AppColors.primaryDark,
            child: Text(initial,
                style: const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w700)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text.rich(
                  TextSpan(children: [
                    TextSpan(
                      text: comment.authorName,
                      style: const TextStyle(
                          color: Colors.white, fontWeight: FontWeight.w700),
                    ),
                    TextSpan(
                      text: '  ${storyCommentAge(comment.createdAt)}',
                      style: const TextStyle(color: Colors.white54),
                    ),
                  ]),
                  style: const TextStyle(fontSize: 13),
                ),
                const SizedBox(height: 3),
                Text(
                  comment.text,
                  style: const TextStyle(
                      color: Colors.white, fontSize: 14.5, height: 1.4),
                ),
              ],
            ),
          ),
          if (onDelete != null)
            IconButton(
              key: ValueKey('story-comment-delete-${comment.id}'),
              tooltip: 'Șterge comentariul',
              icon: const Icon(Icons.delete_outline_rounded,
                  color: Colors.white54, size: 20),
              onPressed: onDelete,
            ),
        ],
      ),
    );
  }
}

/// How a comment went, in a small pill over the field: no dialog or
/// scrim over the story.
class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.text, required this.ok});

  final String text;
  final bool ok;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xCC000000),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              ok ? Icons.check_circle_rounded : Icons.error_outline_rounded,
              color: ok ? const Color(0xFF4CD964) : const Color(0xFFFFB4AB),
              size: 18,
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                text,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
