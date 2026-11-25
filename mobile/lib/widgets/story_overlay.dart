import 'dart:async';

import 'package:flutter/material.dart';
import 'package:like_button/like_button.dart';

import '../services/stories_service.dart';
import '../services/story.dart';
import '../theme.dart';
import 'story_slide_view.dart';

/// A count as the viewer shows it, with Romanian thousands: `2.229`.
String formatStoryCount(int count) {
  final digits = count.abs().toString();
  final grouped = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) grouped.write('.');
    grouped.write(digits[i]);
  }
  return '${count < 0 ? '-' : ''}$grouped';
}

const _shadow = [Shadow(blurRadius: 6, color: Color(0x73000000))];

/// The column of actions on the right, as in Reels: the heart with the
/// story's like count, the message button (when the story takes
/// messages) and share.
class StoryActionColumn extends StatelessWidget {
  const StoryActionColumn({
    super.key,
    required this.story,
    required this.service,
    required this.onMessage,
    required this.onShare,
  });

  final Story story;
  final StoriesService service;

  /// Null when the story takes no messages.
  final VoidCallback? onMessage;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _LikeAction(story: story, service: service),
        if (onMessage != null) ...[
          const SizedBox(height: 18),
          _Action(
            key: const ValueKey('story-message'),
            icon: Icons.chat_bubble_outline_rounded,
            label: 'Mesaj',
            tooltip: 'Trimite un mesaj',
            onPressed: onMessage!,
          ),
        ],
        const SizedBox(height: 18),
        _Action(
          key: const ValueKey('story-share'),
          icon: Icons.send_rounded,
          label: 'Trimite',
          tooltip: 'Distribuie',
          onPressed: onShare,
          turn: -0.08,
        ),
      ],
    );
  }
}

class _Action extends StatelessWidget {
  const _Action({
    super.key,
    required this.icon,
    required this.label,
    required this.tooltip,
    required this.onPressed,
    this.turn = 0,
  });

  final IconData icon;
  final String label;
  final String tooltip;
  final VoidCallback onPressed;

  /// A slight tilt, as the paper plane has in Reels.
  final double turn;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: tooltip,
      excludeSemantics: true,
      child: InkResponse(
        onTap: onPressed,
        radius: 28,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            RotationTransition(
              turns: AlwaysStoppedAnimation(turn),
              child: Icon(icon, color: Colors.white, size: 30,
                  shadows: _shadow),
            ),
            const SizedBox(height: 4),
            Text(label, style: _countStyle),
          ],
        ),
      ),
    );
  }
}

const _countStyle = TextStyle(
  color: Colors.white,
  fontSize: 12.5,
  fontWeight: FontWeight.w600,
  shadows: _shadow,
);

/// The heart and the story's like count under it, liked at once
/// (optimistic); the API hears it right away.
class _LikeAction extends StatelessWidget {
  const _LikeAction({required this.story, required this.service});

  final Story story;
  final StoriesService service;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<Set<String>>(
      stream: service.liked,
      initialData: service.liked.value,
      builder: (context, liked) => StreamBuilder<Map<String, int>>(
        stream: service.likeCounts,
        initialData: service.likeCounts.value,
        builder: (context, _) {
          final isLiked = liked.data?.contains(story.slug) ?? false;
          final count = service.likeCountOf(story);
          return Semantics(
            button: true,
            label: isLiked ? 'Nu-mi mai place' : 'Îmi place',
            value: '$count',
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                LikeButton(
                  key: ValueKey('story-like-${story.slug}'),
                  size: 32,
                  bubblesSize: 44,
                  isLiked: isLiked,
                  circleColor: const CircleColor(
                      start: AppColors.primaryLight, end: AppColors.primary),
                  likeBuilder: (liked) => Icon(
                    liked
                        ? Icons.favorite_rounded
                        : Icons.favorite_border_rounded,
                    color: liked ? AppColors.primary : Colors.white,
                    size: 32,
                    shadows: _shadow,
                  ),
                  onTap: (wasLiked) async {
                    unawaited(service.toggleLike(story));
                    return !wasLiked;
                  },
                ),
                const SizedBox(height: 2),
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 200),
                  transitionBuilder: (child, animation) => SlideTransition(
                    position: Tween(
                      begin: const Offset(0, 0.4),
                      end: Offset.zero,
                    ).animate(animation),
                    child: FadeTransition(opacity: animation, child: child),
                  ),
                  child: Text(
                    count > 0 ? formatStoryCount(count) : 'Îmi place',
                    key: ValueKey('story-likes-$count'),
                    style: _countStyle,
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// The call to action as a full-width bar with a chevron, as Reels' ads
/// have it: it rises in once the slide shows, glassy at first, then fills
/// with its colour, and its chevron nudges toward the target now and then.
class StoryCtaBar extends StatefulWidget {
  const StoryCtaBar({super.key, required this.cta, required this.onPressed});

  final StoryCta cta;
  final VoidCallback onPressed;

  /// When it rises in, and when it fills with its colour.
  static const appearAfter = Duration(milliseconds: 350);
  static const fillAfter = Duration(milliseconds: 1400);

  @override
  State<StoryCtaBar> createState() => _StoryCtaBarState();
}

class _StoryCtaBarState extends State<StoryCtaBar>
    with TickerProviderStateMixin {
  late final AnimationController _enter = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 380),
  );
  late final AnimationController _fill = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 400),
  );
  late final AnimationController _nudge = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  );
  final List<Timer> _timers = [];

  @override
  void initState() {
    super.initState();
    _timers
      ..add(Timer(StoryCtaBar.appearAfter, _enter.forward))
      ..add(Timer(StoryCtaBar.fillAfter, () {
        _fill.forward();
        _nudge.repeat();
      }));
  }

  @override
  void dispose() {
    for (final timer in _timers) {
      timer.cancel();
    }
    _enter.dispose();
    _fill.dispose();
    _nudge.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.cta.color ?? AppColors.primary;
    final textColor = widget.cta.textColor ?? Colors.white;
    final entrance = CurvedAnimation(
        parent: _enter, curve: Curves.fastOutSlowIn);
    return FadeTransition(
      opacity: entrance,
      child: SlideTransition(
        position: Tween(begin: const Offset(0, 0.6), end: Offset.zero)
            .animate(entrance),
        child: AnimatedBuilder(
          animation: _fill,
          builder: (context, child) {
            final t = Curves.easeInOut.transform(_fill.value);
            return Material(
              key: const ValueKey('story-cta-button'),
              color: Color.lerp(const Color(0x40FFFFFF), color, t),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(
                  color: Colors.white.withValues(alpha: 0.35 * (1 - t)),
                ),
              ),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: widget.onPressed,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 18, vertical: 14),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          widget.cta.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Color.lerp(Colors.white, textColor, t),
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      child!,
                    ],
                  ),
                ),
              ),
            );
          },
          child: AnimatedBuilder(
            animation: _nudge,
            builder: (context, child) {
              // A quick nudge to the right, then rest.
              final v = _nudge.value;
              final dx = v < 0.25 ? Curves.easeOut.transform(v / 0.25) * 5
                  : v < 0.5 ? (1 - Curves.easeIn.transform((v - 0.25) / 0.25)) * 5
                  : 0.0;
              return Transform.translate(offset: Offset(dx, 0), child: child);
            },
            child: Icon(Icons.chevron_right_rounded,
                color: widget.cta.textColor ?? Colors.white, size: 26),
          ),
        ),
      ),
    );
  }
}

/// Who the story is from, and the slide's caption, under the call to
/// action.
class StoryAuthorRow extends StatelessWidget {
  const StoryAuthorRow({super.key, required this.story, required this.slide});

  final Story story;
  final StorySlide slide;

  @override
  Widget build(BuildContext context) {
    final author = story.author;
    final avatar = author?.avatarUrl ?? story.bubbleImageUrl;
    final caption = slide.caption ?? (author == null ? null : story.title);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Container(
              width: 34,
              height: 34,
              padding: const EdgeInsets.all(1.5),
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white,
              ),
              child: ClipOval(
                child: avatar == null
                    ? Image.asset('assets/icons/ic_logo_filled.png')
                    : StoryImage(url: avatar),
              ),
            ),
            const SizedBox(width: 10),
            Flexible(
              child: Text(
                author?.name ?? story.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  shadows: _shadow,
                ),
              ),
            ),
          ],
        ),
        if (caption != null) ...[
          const SizedBox(height: 8),
          Text(
            caption,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              height: 1.4,
              shadows: _shadow,
            ),
          ),
        ],
      ],
    );
  }
}

/// "Swipe up" at the bottom edge: a chevron that keeps rising over the
/// label; tapping it does what the swipe does.
class StorySwipeUpHint extends StatefulWidget {
  const StorySwipeUpHint({
    super.key,
    required this.label,
    required this.onTap,
  });

  final String label;
  final VoidCallback onTap;

  @override
  State<StorySwipeUpHint> createState() => _StorySwipeUpHintState();
}

class _StorySwipeUpHintState extends State<StorySwipeUpHint>
    with SingleTickerProviderStateMixin {
  late final AnimationController _rise = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat();

  @override
  void dispose() {
    _rise.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: widget.label,
      hint: 'Glisează în sus',
      excludeSemantics: true,
      child: GestureDetector(
        key: const ValueKey('story-swipe-up'),
        behavior: HitTestBehavior.opaque,
        onTap: widget.onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedBuilder(
                animation: _rise,
                builder: (context, child) {
                  final v = Curves.easeOut.transform(_rise.value);
                  return Opacity(
                    opacity: v < 0.75 ? 1 : 1 - (v - 0.75) / 0.25,
                    child: Transform.translate(
                        offset: Offset(0, 6 - 12 * v), child: child),
                  );
                },
                child: const Icon(Icons.keyboard_arrow_up_rounded,
                    color: Colors.white, size: 30, shadows: _shadow),
              ),
              Text(
                widget.label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  shadows: _shadow,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The field to write to the team from a story, with the placeholder the
/// admin set; the send button shows once there is text.
class StoryMessageField extends StatefulWidget {
  const StoryMessageField({
    super.key,
    required this.hint,
    required this.focusNode,
    required this.onSend,
  });

  final String hint;
  final FocusNode focusNode;

  /// Sends the text, and says how it went.
  final Future<StoryMessageResult> Function(String text) onSend;

  @override
  State<StoryMessageField> createState() => _StoryMessageFieldState();
}

class _StoryMessageFieldState extends State<StoryMessageField> {
  final TextEditingController _text = TextEditingController();
  bool _sending = false;

  /// How the last send went, shown above the field for a moment.
  StoryMessageResult? _result;
  Timer? _resultTimer;

  static String _say(StoryMessageResult result) => switch (result) {
        StoryMessageResult.sent => 'Mesaj trimis',
        StoryMessageResult.tooMany =>
          'Ai trimis multe mesaje. Încearcă peste un minut.',
        StoryMessageResult.failed =>
          'Nu s-a trimis. Verifică internetul și încearcă din nou.',
      };

  @override
  void initState() {
    super.initState();
    _text.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
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
    if (result == StoryMessageResult.sent) {
      _text.clear();
      widget.focusNode.unfocus();
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasText = _text.text.trim().isNotEmpty;
    final result = _result;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedSize(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeInOut,
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            child: result == null
                ? const SizedBox(width: double.infinity)
                : Padding(
                    key: ValueKey(result),
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _StatusChip(
                      text: _say(result),
                      ok: result == StoryMessageResult.sent,
                    ),
                  ),
          ),
        ),
        _field(hasText),
      ],
    );
  }

  Widget _field(bool hasText) {
    return Container(
      height: 48,
      padding: const EdgeInsets.only(left: 18, right: 4),
      decoration: BoxDecoration(
        color: const Color(0x33000000),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.45)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              key: const ValueKey('story-message-field'),
              controller: _text,
              focusNode: widget.focusNode,
              maxLength: StoriesService.maxMessageLength,
              textInputAction: TextInputAction.send,
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
                    ? IconButton(
                        key: const ValueKey('story-message-send'),
                        tooltip: 'Trimite',
                        onPressed: _send,
                        icon: const Icon(Icons.send_rounded,
                            color: Colors.white),
                      )
                    : const SizedBox(width: 12, height: 48),
          ),
        ],
      ),
    );
  }
}

/// How a message went, in a small pill over the field: no dialog or
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
