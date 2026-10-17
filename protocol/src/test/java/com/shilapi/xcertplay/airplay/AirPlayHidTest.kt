package com.shilapi.xcertplay.airplay

import org.junit.Assert.assertArrayEquals
import org.junit.Test

class AirPlayHidTest {
    @Test
    fun touchReleasePreservesCoordinatesForTouchUpInside() {
        assertArrayEquals(
            byteArrayOf(0, 0, 0x40, 0x01, 0x20, 0x02, 1, 0, 0, 0, 0, 0),
            AirPlayHid.touchReport(listOf(AirPlayContact(0, 320.0, 544.0, false))),
        )
    }

    @Test
    fun secondFingerDoesNotBecomeFirstWhenFirstIsLifted() {
        assertArrayEquals(
            byteArrayOf(0, 0, 0, 0, 0, 0, 1, 1, 0x2c, 0x01, 0x90.toByte(), 0x01),
            AirPlayHid.touchReport(listOf(AirPlayContact(1, 300.0, 400.0, true))),
        )
    }
}
