package com.playport.server

import io.ktor.client.plugins.websocket.WebSockets
import io.ktor.client.plugins.websocket.webSocket
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import io.ktor.websocket.Frame
import io.ktor.websocket.close
import io.ktor.websocket.readText
import kotlinx.coroutines.withTimeout
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.util.concurrent.atomic.AtomicInteger

class ViewerAuthTest {
    @get:Rule val temporary = TemporaryFolder()

    private fun config(noAuth: Boolean = false): ServerConfig = ServerConfig(
        identityDir = temporary.root.toPath().resolve("identity"),
        stateDir = temporary.root.toPath().resolve("state"),
        accessToken = "test-secret",
        noAuth = noAuth,
    )

    private fun display() = DisplayState(1280, 720, 60, 100, false)

    @Test
    fun authenticationDefaultsAndPersistentOverride() {
        val defaults = config()
        assertFalse(defaults.noAuth)
        assertFalse(defaults.acceptsViewerToken(null))
        assertFalse(defaults.acceptsViewerToken(""))
        val open = ServerConfig.fromArgs(arrayOf("--no-auth"), defaults)
        assertTrue(open.acceptsViewerToken(null))
        val store = ConfigStore(open.stateDir)
        store.save(PersistentConfig.of(open, display()))
        val saved = store.load()!!.toServerDefaults(open.identityDir, open.stateDir)
        assertTrue(saved.noAuth)
        assertFalse(ServerConfig.fromArgs(arrayOf("--require-auth"), saved).noAuth)
        assertFalse(PersistentConfig().noAuth)
    }

    @Test
    fun protectedHttpRequiresTheCorrectToken() = testApplication {
        val changes = AtomicInteger()
        val hub = WebHub(config(), display()).apply {
            onApplyDisplay = { _, _, _, _, _ -> changes.incrementAndGet(); null }
        }
        application { hub.install(this, temporary.root.toPath()) }
        assertEquals("""{"required":true}""", client.get("/api/auth").bodyAsText())
        for (suffix in listOf("", "?token=wrong", "?token=")) {
            assertEquals(HttpStatusCode.Forbidden, client.post("/api/display$suffix") {
                setBody("""{"width":1280,"height":720}""")
            }.status)
        }
        assertEquals(0, changes.get())
        assertEquals(HttpStatusCode.OK, client.post("/api/display?token=test-secret") {
            setBody("""{"width":1280,"height":720}""")
        }.status)
        assertEquals(1, changes.get())
    }

    @Test
    fun protectedWebSocketRejectsMissingOrWrongTokens() = testApplication {
        val hub = WebHub(config(), display())
        application { hub.install(this, temporary.root.toPath()) }
        val sockets = createClient { install(WebSockets) }
        for (suffix in listOf("", "?token=wrong")) {
            sockets.webSocket("/ws$suffix") {
                assertEquals(1008, withTimeout(3_000) { closeReason.await() }?.code?.toInt())
            }
        }
        sockets.webSocket("/ws?token=test-secret") {
            assertTrue(withTimeout(3_000) { (incoming.receive() as Frame.Text).readText() }.contains("hello"))
            send(Frame.Text("""{"type":"ping"}"""))
            assertEquals("""{"type":"pong"}""", withTimeout(3_000) { (incoming.receive() as Frame.Text).readText() })
            close()
        }
    }

    @Test
    fun openModeAllowsDisplayAndWebSocketControlWithoutAToken() = testApplication {
        val changes = AtomicInteger()
        val inputs = AtomicInteger()
        val hub = WebHub(config(noAuth = true), display()).apply {
            onApplyDisplay = { _, _, _, _, _ -> changes.incrementAndGet(); null }
            inputHandler = { inputs.incrementAndGet() }
        }
        application { hub.install(this, temporary.root.toPath()) }
        assertEquals("""{"required":false}""", client.get("/api/auth").bodyAsText())
        assertEquals(HttpStatusCode.OK, client.post("/api/display") {
            setBody("""{"width":1280,"height":720}""")
        }.status)
        assertEquals(1, changes.get())
        val sockets = createClient { install(WebSockets) }
        sockets.webSocket("/ws") {
            assertTrue(withTimeout(3_000) { (incoming.receive() as Frame.Text).readText() }.contains("hello"))
            send(Frame.Text("""{"type":"knob","knob":{"home":true}}"""))
            send(Frame.Text("""{"type":"ping"}"""))
            assertEquals("""{"type":"pong"}""", withTimeout(3_000) { (incoming.receive() as Frame.Text).readText() })
            assertEquals(1, inputs.get())
            close()
        }
    }
}
