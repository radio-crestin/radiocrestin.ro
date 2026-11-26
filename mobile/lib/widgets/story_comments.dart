import 'dart:async';

import 'package:flutter/material.dart';

import '../services/stories_service.dart';
import '../services/story.dart';
import '../theme.dart';
import 'story_overlay.dart' show isCompactStory, formatStoryCount;
import 'story_slide_view.dart' show StoryImage;

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
      StoryCommentResult.notAllowed =>
        'La această poveste comentează doar profilurile.',
      StoryCommentResult.failed =>
        'Nu s-a publicat. Verifică internetul și încearcă din nou.',
    };

/// The field for a public comment: a globe and the admin's placeholder say
/// it is public; while it is being written, a line above it says who will
/// see it and under which profile (its name and picture).
///
/// Shown only to a phone that may comment (`can_comment`).
class StoryCommentField extends StatefulWidget {
  const StoryCommentField({
    super.key,
    required this.hint,
    required this.profile,
    required this.focusNode,
    required this.onSend,
  });

  final String hint;

  /// Whom the comment shows as; null: "Ascultător".
  final StoryAuthor? profile;
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
                        child: _PublicNotice(profile: widget.profile),
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

/// "Public: every listener sees it, as «Ana»", with the profile's picture.
class _PublicNotice extends StatelessWidget {
  const _PublicNotice({required this.profile});

  final StoryAuthor? profile;

  @override
  Widget build(BuildContext context) {
    final name = profile?.name ?? StoryComment.anonymousName;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 6, 12, 6),
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
                const TextSpan(text: ' · îl văd toți ascultătorii, ca '),
                WidgetSpan(
                  alignment: PlaceholderAlignment.middle,
                  child: Padding(
                    padding: const EdgeInsets.only(right: 4),
                    child: StoryAvatar(
                        name: name, url: profile?.avatarUrl, size: 18),
                  ),
                ),
                TextSpan(
                  text: name,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ]),
              key: const ValueKey('story-comment-public'),
              style: const TextStyle(color: Colors.white, fontSize: 12.5),
            ),
          ),
        ],
      ),
    );
  }
}

/// A profile's round picture; its initial on a colour of its own while
/// the picture loads, when it can't, or when there is none.
class StoryAvatar extends StatelessWidget {
  const StoryAvatar({
    super.key,
    required this.name,
    required this.url,
    this.size = 32,
  });

  final String name;
  final String? url;
  final double size;

  // The brand's pink and darker tones that keep white letters readable.
  static const _colors = [
    AppColors.primaryDark,
    Color(0xFF6A1B9A),
    Color(0xFF283593),
    Color(0xFF00695C),
    Color(0xFF8D4A00),
    Color(0xFF455A64),
  ];

  @override
  Widget build(BuildContext context) {
    final url = this.url;
    final initial = Container(
      alignment: Alignment.center,
      color: _colors[name.hashCode.abs() % _colors.length],
      child: Text(
        name.isEmpty ? '?' : name.characters.first.toUpperCase(),
        style: TextStyle(
          color: Colors.white,
          fontSize: size * 0.45,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
    return SizedBox.square(
      dimension: size,
      child: ClipOval(
        child: url == null
            ? initial
            : StoryImage(url: url, fallback: initial),
      ),
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
            // Only a phone that may comment gets the field; the others
            // read.
            StreamBuilder<Map<String, StoryCommentAccess>>(
              stream: widget.service.commentAccess,
              builder: (context, _) {
                final access = widget.service.commentAccessOf(widget.story);
                if (access == null || !access.canComment) {
                  return const SafeArea(
                      top: false, child: SizedBox(width: double.infinity));
                }
                return SafeArea(
                  top: false,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Divider(height: 1, color: Colors.white12),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                        child: StoryCommentField(
                          hint: widget.story.comments.hint,
                          profile: access.profile,
                          focusNode: _focus,
                          onSend: _post,
                        ),
                      ),
                    ],
                  ),
                );
              },
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
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 4, 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          StoryAvatar(
            key: ValueKey('story-comment-avatar-${comment.id}'),
            name: comment.authorName,
            url: comment.authorAvatarUrl,
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
