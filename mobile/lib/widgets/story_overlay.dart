import 'dart:async';

import 'package:flutter/material.dart';
import 'package:like_button/like_button.dart';

import '../services/stories_service.dart';
import '../services/story.dart';
import '../theme.dart';
import 'story_slide_view.dart';

/// Whether the screen is short (a phone held sideways): the overlay
/// tightens to leave the slide in view.
bool isCompactStory(BuildContext context) =>
    MediaQuery.sizeOf(context).height < 500;

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
/// story's like count, the comments with theirs (when the story takes
/// comments) and share.
class StoryActionColumn extends StatelessWidget {
  const StoryActionColumn({
    super.key,
    required this.story,
    required this.service,
    required this.onComments,
    required this.onShare,
  });

  final Story story;
  final StoriesService service;

  /// Null when the story takes no comments.
  final VoidCallback? onComments;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    final compact = isCompactStory(context);
    final gap = SizedBox(height: compact ? 10 : 18);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _LikeAction(story: story, service: service),
        if (onComments != null) ...[
          gap,
          StreamBuilder<Map<String, int>>(
            stream: service.commentCounts,
            builder: (context, _) {
              final count = service.commentCountOf(story);
              return _Action(
                key: const ValueKey('story-comments'),
                icon: Icons.mode_comment_outlined,
                label: count > 0 ? formatStoryCount(count) : 'Comentarii',
                tooltip: 'Comentarii',
                onPressed: onComments!,
                // The count is what the column is for: it stays.
                showLabel: !compact || count > 0,
              );
            },
          ),
        ],
        gap,
        _Action(
          key: const ValueKey('story-share'),
          icon: Icons.send_rounded,
          label: 'Trimite',
          tooltip: 'Distribuie',
          onPressed: onShare,
          turn: -0.08,
          showLabel: !compact,
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
    this.showLabel = true,
  });

  final bool showLabel;
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
            if (showLabel) ...[
              const SizedBox(height: 4),
              Text(label, style: _countStyle),
            ],
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

/// A call to action coming in, as on the website's player: its room
/// opens smoothly, pushing what is above it up, and it rises in.
///
/// Hidden, it takes no room and no taps.
class StoryCtaReveal extends StatefulWidget {
  const StoryCtaReveal({
    super.key,
    required this.shown,
    required this.child,
    this.alignment = Alignment.topLeft,
  });

  final bool shown;
  final Widget child;

  /// Where it sits across its room: the bar on the left, the swipe-up
  /// hint in the middle.
  final Alignment alignment;

  /// How long the room takes to open, and the rise with its overshoot.
  static const roomDuration = Duration(milliseconds: 350);
  static const riseDuration = Duration(milliseconds: 450);

  @override
  State<StoryCtaReveal> createState() => _StoryCtaRevealState();
}

class _StoryCtaRevealState extends State<StoryCtaReveal>
    with SingleTickerProviderStateMixin {
  // The website's curves: the room eases out, the rise springs past.
  static const _roomCurve = Cubic(0.33, 1, 0.68, 1);
  static const _riseCurve = Cubic(0.2, 1.3, 0.45, 1);

  late final AnimationController _in = AnimationController(
    vsync: this,
    duration: StoryCtaReveal.riseDuration,
    value: widget.shown ? 1 : 0,
  );

  @override
  void didUpdateWidget(StoryCtaReveal oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.shown && !oldWidget.shown) _in.forward();
    if (!widget.shown && oldWidget.shown) _in.value = 0;
  }

  @override
  void dispose() {
    _in.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const roomShare = 350 / 450;
    return AnimatedBuilder(
      animation: _in,
      child: widget.child,
      builder: (context, child) {
        final v = _in.value;
        if (v == 0) return const SizedBox.shrink();
        final room = _roomCurve.transform((v / roomShare).clamp(0.0, 1.0));
        final rise = _riseCurve.transform(v);
        final fade = Curves.ease.transform((v / roomShare).clamp(0.0, 1.0));
        return ClipRect(
          // Open, its shadow may spill out.
          clipBehavior: room < 1 ? Clip.hardEdge : Clip.none,
          child: Align(
            alignment: widget.alignment,
            heightFactor: room,
            child: Opacity(
              opacity: fade,
              child: Transform.translate(
                offset: Offset(0, 12 * (1 - rise)),
                child: Transform.scale(
                  scale: 0.96 + 0.04 * rise,
                  alignment: Alignment(widget.alignment.x, 1),
                  child: child,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// The call to action as a full-width bar, as Instagram's ads have it:
/// glassy as it comes in, then, once [filled], its colour sweeps in from
/// the left and the label turns to its text colour.
class StoryCtaBar extends StatefulWidget {
  const StoryCtaBar({
    super.key,
    required this.cta,
    required this.filled,
    required this.onPressed,
  });

  final StoryCta cta;
  final bool filled;
  final VoidCallback onPressed;

  /// How long the colour takes to sweep in.
  static const fillDuration = Duration(milliseconds: 450);

  @override
  State<StoryCtaBar> createState() => _StoryCtaBarState();
}

class _StoryCtaBarState extends State<StoryCtaBar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _fill = AnimationController(
    vsync: this,
    duration: StoryCtaBar.fillDuration,
    value: widget.filled ? 1 : 0,
  );

  @override
  void didUpdateWidget(StoryCtaBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.filled && !oldWidget.filled) _fill.forward();
    if (!widget.filled && oldWidget.filled) _fill.value = 0;
  }

  @override
  void dispose() {
    _fill.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.cta.color ?? AppColors.primary;
    final textColor = widget.cta.textColor ?? Colors.white;
    const radius = BorderRadius.all(Radius.circular(10));
    return Semantics(
      button: true,
      label: widget.cta.label,
      excludeSemantics: true,
      child: AnimatedBuilder(
        animation: _fill,
        builder: (context, _) {
          final t = Curves.easeOutCubic.transform(_fill.value);
          final label = Color.lerp(Colors.white, textColor, t)!;
          return DecoratedBox(
            key: const ValueKey('story-cta-button'),
            decoration: BoxDecoration(
              borderRadius: radius,
              boxShadow: [
                BoxShadow(
                  color: color.withValues(alpha: 0.45 * t),
                  blurRadius: 14,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: radius,
              child: Material(
                color: const Color(0x38FFFFFF),
                child: InkWell(
                  onTap: widget.onPressed,
                  child: SizedBox(
                    height: isCompactStory(context) ? 36 : 40,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        // The colour sweeping in from the left edge.
                        FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: t,
                          child: ColoredBox(color: color),
                        ),
                        Padding(
                          padding: const EdgeInsets.only(left: 14, right: 8),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  widget.cta.label,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: label,
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.1,
                                  ),
                                ),
                              ),
                              Icon(Icons.chevron_right_rounded,
                                  color: label, size: 22),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          );
        },
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
    final caption = isCompactStory(context)
        ? null
        : slide.caption ?? (author == null ? null : story.title);
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
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 2),
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
                        offset: Offset(0, 4 - 8 * v), child: child),
                  );
                },
                child: const Icon(Icons.keyboard_arrow_up_rounded,
                    color: Colors.white, size: 22, shadows: _shadow),
              ),
              Text(
                widget.label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
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
