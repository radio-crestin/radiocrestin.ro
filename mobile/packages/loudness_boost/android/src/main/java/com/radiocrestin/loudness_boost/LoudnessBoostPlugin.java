package com.radiocrestin.loudness_boost;

import android.media.audiofx.LoudnessEnhancer;
import android.util.Log;

import androidx.annotation.NonNull;

import io.flutter.embedding.engine.plugins.FlutterPlugin;
import io.flutter.plugin.common.MethodCall;
import io.flutter.plugin.common.MethodChannel;

/**
 * Raises an audio session's loudness with a {@link LoudnessEnhancer}: a gain
 * above full volume, with the platform's limiter so peaks don't clip. The
 * effect's lifetime is {@link LoudnessBoost}'s.
 *
 * <p>A plugin, not a channel in MainActivity, so it is there in every
 * engine, including the one audio_service starts for Android Auto without
 * the activity.
 */
public class LoudnessBoostPlugin implements FlutterPlugin, MethodChannel.MethodCallHandler {
    private static final String TAG = "LoudnessBoost";

    private MethodChannel channel;
    private final LoudnessBoost boost = new LoudnessBoost(
            LoudnessBoostPlugin::createEnhancer,
            (message, error) -> Log.w(TAG, message, error));

    @Override
    public void onAttachedToEngine(@NonNull FlutterPluginBinding binding) {
        channel = new MethodChannel(binding.getBinaryMessenger(), "com.radiocrestin.loudness_boost");
        channel.setMethodCallHandler(this);
    }

    @Override
    public void onDetachedFromEngine(@NonNull FlutterPluginBinding binding) {
        channel.setMethodCallHandler(null);
        channel = null;
        boost.release();
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
        result.success(boost.apply(sessionId == null ? 0 : sessionId, gainMb));
    }

    private static LoudnessBoost.Effect createEnhancer(int sessionId) {
        final LoudnessEnhancer enhancer = new LoudnessEnhancer(sessionId);
        return new LoudnessBoost.Effect() {
            @Override
            public void setTargetGain(int gainMb) {
                enhancer.setTargetGain(gainMb);
            }

            @Override
            public void setEnabled(boolean enabled) {
                enhancer.setEnabled(enabled);
            }

            @Override
            public void release() {
                enhancer.release();
            }
        };
    }
}
