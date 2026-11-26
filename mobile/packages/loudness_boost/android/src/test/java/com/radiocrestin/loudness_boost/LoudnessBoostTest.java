package com.radiocrestin.loudness_boost;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.ArrayList;
import java.util.List;

import org.junit.Test;

/** How the station's boost drives the LoudnessEnhancer's lifetime. */
public class LoudnessBoostTest {
    static final class FakeEffect implements LoudnessBoost.Effect {
        final int sessionId;
        int gainMb;
        boolean enabled;
        boolean released;

        FakeEffect(int sessionId) {
            this.sessionId = sessionId;
        }

        @Override
        public void setTargetGain(int gainMb) {
            this.gainMb = gainMb;
        }

        @Override
        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        @Override
        public void release() {
            released = true;
        }
    }

    final List<FakeEffect> created = new ArrayList<>();
    final List<String> warnings = new ArrayList<>();
    boolean failCreate;

    final LoudnessBoost boost = new LoudnessBoost(sessionId -> {
        if (failCreate) throw new RuntimeException("Cannot initialize effect engine");
        FakeEffect effect = new FakeEffect(sessionId);
        created.add(effect);
        return effect;
    }, (message, error) -> warnings.add(message));

    @Test
    public void noEffectWithoutABoost() {
        assertTrue(boost.apply(7, 0));
        assertTrue(boost.apply(7, -600));
        assertEquals(0, created.size());
    }

    @Test
    public void aBoostCreatesOneEnabledEffectAtTheGain() {
        assertTrue(boost.apply(7, 400));
        assertEquals(1, created.size());
        FakeEffect effect = created.get(0);
        assertEquals(7, effect.sessionId);
        assertEquals(400, effect.gainMb);
        assertTrue(effect.enabled);
    }

    @Test
    public void aNewGainOnTheSameSessionReusesTheEffect() {
        boost.apply(7, 400);
        assertTrue(boost.apply(7, 250));
        assertEquals(1, created.size());
        assertEquals(250, created.get(0).gainMb);
    }

    @Test
    public void aNewSessionMovesTheEffect() {
        boost.apply(7, 400);
        assertTrue(boost.apply(9, 400));
        assertEquals(2, created.size());
        assertTrue(created.get(0).released);
        assertEquals(9, created.get(1).sessionId);
        assertEquals(9, boost.sessionId());
    }

    @Test
    public void zeroDbReleasesTheEffect() {
        boost.apply(7, 400);
        assertTrue(boost.apply(7, 0));
        assertTrue(created.get(0).released);
        assertEquals(0, boost.sessionId());
    }

    @Test
    public void noSessionYetMeansNoBoost() {
        assertFalse(boost.apply(0, 400));
        assertEquals(0, created.size());
    }

    @Test
    public void aDeviceWithoutTheEffectPlaysUnboostedWithoutThrowing() {
        failCreate = true;
        assertFalse(boost.apply(7, 400));
        assertEquals(0, boost.sessionId());
        assertEquals(1, warnings.size());
        failCreate = false;
        assertTrue(boost.apply(7, 400));
    }
}
