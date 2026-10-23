import Foundation
import Testing
@testable import paleoclaw

struct VoiceWakeGatewaySyncTests {
    @Test func `decode gateway triggers from JSON sanitizes`() {
        let payload = #"{"triggers":[" paleoclaw  ","", "computer"]}"#
        let triggers = VoiceWakePreferences.decodeGatewayTriggers(from: Data(payload.utf8))
        #expect(triggers == ["paleoclaw", "computer"])
    }

    @Test func `decode gateway triggers from JSON falls back when empty`() {
        let payload = #"{"triggers":["  ",""]}"#
        let triggers = VoiceWakePreferences.decodeGatewayTriggers(from: Data(payload.utf8))
        #expect(triggers == VoiceWakePreferences.defaultTriggerWords)
    }

    @Test func `decode gateway triggers from invalid JSON returns nil`() {
        let triggers = VoiceWakePreferences.decodeGatewayTriggers(from: Data("not json".utf8))
        #expect(triggers == nil)
    }
}
