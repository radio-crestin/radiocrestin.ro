package com.radiocrestin.loudness_boost;

import android.media.audiofx.LoudnessEnhancer;
import android.util.Log;

import androidx.annotation.NonNull;

import io.flutter.embedding.engine.plugins.FlutterPlugin;
import io.flutter.plugin.common.MethodCall;
import io.flutter.plugin.common.MethodChannel;

/**
 * Raises an audio session's loudness with a {@link LoudnessEnhancer}: a gain
 * above full volume, with the platform's limiter so peaks don't clip.
 *
 * <p>The effect exists only while a gain above 0 dB is asked for, and only
 * one at a time. Some devices can't create it ("Cannot initialize effect
 * engine"): {@code apply} then answers false and playback goes on without
 * the boost, never failing because of it.
 *
 * <p>A plugin, not a channel in MainActivity, so it is there in every
 * engine, including the one audio_service starts for Android Auto without
 * the activity.
 */
public class LoudnessBoostPlugin implements FlutterPlugin, MethodChannel.MethodCallHandler {
    private static final String TAG = "LoudnessBoost";

    private MethodChannel channel;
    private LoudnessEnhancer enhancer;
    private int enhancerSessionId;

    @Override
    public void onAttachedToEngine(@NonNull FlutterPluginBinding binding) {
        channel = new MethodChannel(binding.getBinaryMessenger(), "com.radiocrestin.loudness_boost");
        channel.setMethodCallHandler(this);
    }

    @Override
    public void onDetachedFromEngine(@NonNull FlutterPluginBinding binding) {
        channel.setMethodCallHandler(null);
        channel = null;
        release();
    }

    @Override
    public void onMethodCall(@NonNull MethodCall call, @NonNull MethodChannel.Result result) {
        if (!"apply".equals(call.method)) {
            result.notImplemented();
            return;
        }
        Integer sessionId = call.argument("sessionId");
        Number gainDb = call.argument("gainDb");
        int gainMb = gainDb == null ? 0 : (int) Math.round(gainDb.doubleValue() * 100);
        result.success(apply(sessionId == null ? 0 : sessionId, gainMb));
    }

    /** Boosts session {@code sessionId} by {@code gainMb} millibels; 0 removes it. */
    private boolean apply(int sessionId, int gainMb) {
        if (sessionId <= 0 || gainMb <= 0) {
            release();
            return gainMb <= 0;
        }
        try {
            if (enhancer == null || enhancerSessionId != sessionId) {
                release();
                enhancer = new LoudnessEnhancer(sessionId);
                enhancerSessionId = sessionId;
            }
            enhancer.setTargetGain(gainMb);
            enhancer.setEnabled(true);
            return true;
        } catch (Throwable e) {
            Log.w(TAG, "LoudnessEnhancer unavailable; the gain is not applied", e);
            release();
            return false;
        }
    }

    private void release() {
        if (enhancer == null) return;
        try {
            enhancer.release();
        } catch (Throwable e) {
            Log.w(TAG, "LoudnessEnhancer release failed", e);
        }
        enhancer = null;
        enhancerSessionId = 0;
    }
}
