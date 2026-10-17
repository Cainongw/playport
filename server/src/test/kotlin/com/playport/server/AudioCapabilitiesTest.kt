package com.playport.server

import com.shilapi.xcertplay.airplay.AirPlayInfoPlist
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class AudioCapabilitiesTest {
    @get:Rule val temporary = TemporaryFolder()

    @Test
    fun receiverOffersInputAlongsideOutputForCarPlayAudioRouting() {
        val root = temporary.root.toPath()
        val config = ServerConfig(identityDir = root.resolve("identity"), stateDir = root.resolve("state"), bindAddress = "127.0.0.1")
        CarPlayServer(config).use { server ->
            val info = AirPlayInfoPlist.build(server.airPlayConfig)
            val formats = info["audioFormats"] as List<*>
            for (audioType in listOf("default", "telephony", "speechRecognition")) {
                val format = formats.filterIsInstance<Map<*, *>>()
                    .single { it["type"] == 100 && it["audioType"] == audioType }
                assertTrue("$audioType must offer output", (format["audioOutputFormats"] as Number).toLong() != 0L)
                assertTrue("$audioType must offer the implemented microphone uplink", (format["audioInputFormats"] as? Number)?.toLong()?.let { it != 0L } == true)
            }
        }
    }
}
