package com.radiocrestin.loudness_boost;

/**
 * Keeps at most one loudness effect, on the audio session that plays, at the
 * gain asked for: created only while a gain above 0 dB is asked for,
 * re-created when the session changes, released at 0 dB.
 *
 * <p>Creating the effect can fail on some devices ("Cannot initialize effect
 * engine"): {@link #apply} then answers false and nothing is left attached.
 */
final class LoudnessBoost {
    /** One loudness effect, as Android's {@code LoudnessEnhancer} is. */
    interface Effect {
        void setTargetGain(int gainMb);

        void setEnabled(boolean enabled);

        void release();
    }

    /** Creates the effect for an audio session; may throw. */
    interface EffectFactory {
        Effect create(int sessionId);
    }

    /** Where a failure is reported. */
    interface Logger {
        void warn(String message, Throwable error);
    }

    private final EffectFactory factory;
    private final Logger logger;
    private Effect effect;
    private int effectSessionId;

    LoudnessBoost(EffectFactory factory, Logger logger) {
        this.factory = factory;
        this.logger = logger;
    }

    /**
     * Boosts session {@code sessionId} by {@code gainMb} millibels; 0 or less
     * removes the boost. Answers whether the session now plays at that gain.
     */
    boolean apply(int sessionId, int gainMb) {
        if (gainMb <= 0) {
            release();
            return true;
        }
        if (sessionId <= 0) {
            release();
            return false;
        }
        try {
            if (effect == null || effectSessionId != sessionId) {
                release();
                effect = factory.create(sessionId);
                effectSessionId = sessionId;
            }
            effect.setTargetGain(gainMb);
            effect.setEnabled(true);
            return true;
        } catch (Throwable e) {
            logger.warn("LoudnessEnhancer unavailable; the gain is not applied", e);
            release();
            return false;
        }
    }

    /** Releases the effect, if there is one. */
    void release() {
        if (effect == null) return;
        try {
            effect.release();
        } catch (Throwable e) {
            logger.warn("LoudnessEnhancer release failed", e);
        }
        effect = null;
        effectSessionId = 0;
    }

    /** The session the effect is on; 0 with none. */
    int sessionId() {
        return effectSessionId;
    }
}
