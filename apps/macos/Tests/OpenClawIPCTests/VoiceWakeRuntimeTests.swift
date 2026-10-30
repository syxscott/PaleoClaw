import SwabbleKit
import Testing
@testable import paleoclaw

struct VoiceWakeRuntimeTests {
    @Test(arguments: ["hey paleoclaw", "tell me about paleoclaw"])
    func `diagnostic trigger only fallback rejects trailing mentions`(transcript: String) {
        let match = VoiceWakeRecognitionDebugSupport.triggerOnlyFallbackMatch(
            transcript: transcript,
            triggers: ["paleoclaw"],
            trimWake: WakeWordGate.stripWake)
        if transcript == "hey paleoclaw" {
            #expect(match?.command == "")
            #expect(match?.trigger == "paleoclaw")
        } else {
            #expect(match == nil)
        }
    }

    @Test func `trims after trigger keeps post speech`() {
        let triggers = ["claude", "paleoclaw"]
        let text = "hey Claude how are you"
        #expect(VoiceWakeRuntime.trimmedAfterTrigger(text, triggers: triggers) == "how are you")
    }

    @Test func `trims after trigger returns original when no trigger`() {
        let triggers = ["claude"]
        let text = "good morning friend"
        #expect(VoiceWakeRuntime.trimmedAfterTrigger(text, triggers: triggers) == text)
    }

    @Test func `trims after first matching trigger`() {
        let triggers = ["buddy", "claude"]
        let text = "hello buddy this is after trigger claude also here"
        #expect(VoiceWakeRuntime
            .trimmedAfterTrigger(text, triggers: triggers) == "this is after trigger claude also here")
    }

    @Test func `has content after trigger false when only trigger`() {
        let triggers = ["paleoclaw"]
        let text = "hey paleoclaw"
        #expect(VoiceWakeRuntime.trimmedAfterTrigger(text, triggers: triggers).isEmpty)
    }

    @Test func `has content after trigger true when speech continues`() {
        let triggers = ["claude"]
        let text = "claude write a note"
        #expect(!VoiceWakeRuntime.trimmedAfterTrigger(text, triggers: triggers).isEmpty)
    }

    @Test func `trigger only allows filler before trigger`() {
        let triggers = ["paleoclaw"]
        let text = "uh paleoclaw"
        #expect(VoiceWakeRuntime.isTriggerOnlyText(transcript: text, triggers: triggers))
    }

    @Test func `trigger only rejects trailing wake word mentions in ordinary speech`() {
        let triggers = ["paleoclaw"]
        let text = "tell me about paleoclaw"
        #expect(!VoiceWakeRuntime.isTriggerOnlyText(transcript: text, triggers: triggers))
    }

    @Test func `matched trigger finds trigger not at transcript start`() {
        let triggers = ["paleoclaw"]
        let text = "uh paleoclaw"
        #expect(VoiceWakeTextUtils.matchedTriggerWord(transcript: text, triggers: triggers) == "paleoclaw")
    }

    @Test func `matched trigger rejects larger word suffix matches`() {
        let triggers = ["computer"]
        let text = "uh computers"
        #expect(VoiceWakeTextUtils.matchedTriggerWord(transcript: text, triggers: triggers) == nil)
    }

    @Test func `matched trigger prefers most specific overlapping phrase`() {
        let triggers = ["paleoclaw", "hey paleoclaw"]
        let text = "hey paleoclaw"
        #expect(VoiceWakeTextUtils.matchedTriggerWord(transcript: text, triggers: triggers) == "hey paleoclaw")
    }

    @Test func `matched trigger handles width insensitive forms without whitespace tokens`() {
        let triggers = ["paleoclaw"]
        let text = "ＯｐｅｎＣｌａｗ"
        #expect(VoiceWakeTextUtils.matchedTriggerWord(transcript: text, triggers: triggers) == "paleoclaw")
    }

    @Test func `matched trigger handles chinese forms without whitespace tokens`() {
        let triggers = ["小爪"]
        let text = "嘿小爪"
        #expect(VoiceWakeTextUtils.matchedTriggerWord(transcript: text, triggers: triggers) == "小爪")
    }

    @Test func `text only fallback populates matched trigger`() {
        let transcript = "hey paleoclaw do thing"
        let config = WakeWordGateConfig(triggers: ["paleoclaw"], minCommandLength: 1)
        let match = VoiceWakeRecognitionDebugSupport.textOnlyFallbackMatch(
            transcript: transcript,
            triggers: ["paleoclaw"],
            config: config,
            trimWake: VoiceWakeRuntime.trimmedAfterTrigger)
        #expect(match?.trigger == "paleoclaw")
    }

    @Test func `text only fallback keeps the first trigger phrase when later words match another trigger`() {
        let transcript = "paleoclaw tell me about computer vision"
        let config = WakeWordGateConfig(triggers: ["paleoclaw", "computer"], minCommandLength: 1)
        let match = VoiceWakeRecognitionDebugSupport.textOnlyFallbackMatch(
            transcript: transcript,
            triggers: ["paleoclaw", "computer"],
            config: config,
            trimWake: VoiceWakeRuntime.trimmedAfterTrigger)
        #expect(match?.trigger == "paleoclaw")
    }

    @Test func `text only fallback rejects filler prefixed larger word suffix matches`() {
        let transcript = "uh computers"
        let config = WakeWordGateConfig(triggers: ["computer"], minCommandLength: 1)
        let match = VoiceWakeRecognitionDebugSupport.textOnlyFallbackMatch(
            transcript: transcript,
            triggers: ["computer"],
            config: config,
            trimWake: VoiceWakeRuntime.trimmedAfterTrigger)
        #expect(match == nil)
    }

    @Test func `trims after chinese trigger keeps post speech`() {
        let triggers = ["小爪", "paleoclaw"]
        let text = "嘿 小爪 帮我打开设置"
        #expect(VoiceWakeRuntime.trimmedAfterTrigger(text, triggers: triggers) == "帮我打开设置")
    }

    @Test func `trims after trigger handles width insensitive forms`() {
        let triggers = ["paleoclaw"]
        let text = "ＯｐｅｎＣｌａｗ 请帮我"
        #expect(VoiceWakeRuntime.trimmedAfterTrigger(text, triggers: triggers) == "请帮我")
    }
}
