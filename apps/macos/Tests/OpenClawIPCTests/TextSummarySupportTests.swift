import Testing
@testable import paleoclaw

struct TextSummarySupportTests {
    private static let recoveryDiagnostics: [(String, String)] = [
        (
            "Gateway uninstall failed: service inspection unavailable\n[paleoclaw] The CLI command failed.\n" +
                "[paleoclaw] For help, run `paleoclaw --profile example doctor`.",
            "Gateway uninstall failed: service inspection unavailable"),
        (
            "[paleoclaw] paleoclaw needs a manual recovery step.\n" +
                "[paleoclaw] Reason: Agent database schema 2147483646 is newer than supported.\n" +
                "[paleoclaw] Help: paleoclaw --help",
            "[paleoclaw] Reason: Agent database schema 2147483646 is newer than supported."),
        (
            "[paleoclaw] The CLI command failed.\n[paleoclaw] Reason: Service ownership changed.\n" +
                "[paleoclaw] Stack:\n[paleoclaw] Error: Service ownership changed.\n" +
                "[paleoclaw]     at checkCurrent (service.js:12:3)\n" +
                "[paleoclaw] Try: paleoclaw doctor\n[paleoclaw] Help: paleoclaw --help",
            "[paleoclaw] Reason: Service ownership changed."),
        ("Error: old failure\nHelp: normal application output", "Help: normal application output"),
    ]

    @Test(arguments: Self.recoveryDiagnostics)
    func `surfaces CLI diagnostics before recovery footers`(output: String, expected: String) {
        #expect(TextSummarySupport.summarizeLastLine(output) == expected)
    }

    @Test func `keeps the last line for plain output`() {
        #expect(TextSummarySupport.summarizeLastLine("first\nsecond") == "second")
    }

    @Test func `returns nil for blank output`() {
        #expect(TextSummarySupport.summarizeLastLine(" \n\t\n") == nil)
    }

    @Test func `truncates long lines`() {
        let summary = TextSummarySupport.summarizeLastLine(String(repeating: "x", count: 300))
        #expect(summary?.count == 200)
        #expect(summary?.hasSuffix("…") == true)
    }

    @Test func `surfaces the error line instead of the Node version banner`() {
        let nodeFatal = """
        node:internal/modules/cjs/loader:1215
          throw err;
          ^

        Error: Cannot find module '/Users/example/dist/index.js'
            at Function._resolveFilename (node:internal/modules/cjs/loader:1212:15)
            at node:internal/main/run_main_module:36:49 {
          code: 'MODULE_NOT_FOUND'
        }

        Node.js v26.5.1
        """
        #expect(TextSummarySupport.summarizeLastLine(nodeFatal)
            == "Error: Cannot find module '/Users/example/dist/index.js'")
    }

    @Test func `falls back to the last real line when no error line precedes the banner`() {
        let output = "some diagnostic\nNode.js v26.5.1"
        #expect(TextSummarySupport.summarizeLastLine(output) == "some diagnostic")
    }

    @Test func `banner-only output keeps the banner`() {
        #expect(TextSummarySupport.summarizeLastLine("Node.js v26.5.1") == "Node.js v26.5.1")
    }

    @Test func `does not jump to old error lines without a banner`() {
        let output = "Error: transient\nretrying\ndone"
        #expect(TextSummarySupport.summarizeLastLine(output) == "done")
    }
}
