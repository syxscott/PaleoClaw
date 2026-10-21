import Foundation
import Testing
@testable import paleoclaw

struct NetworkStatusServiceTests {
    @Test func `reads an initial network path`() async throws {
        let payload = try await NetworkStatusService().currentStatus()

        #expect(!payload.interfaces.isEmpty)
    }
}
