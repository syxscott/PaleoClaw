import CryptoKit
import Foundation
import OSLog
import Security

enum ExecSecurity: String, CaseIterable, Codable, Identifiable {
    case deny
    case allowlist
    case full

    var id: String {
        self.rawValue
    }

    var title: String {
        switch self {
        case .deny: "Deny"
        case .allowlist: "Allowlist"
        case .full: "Always Allow"
        }
    }
}

enum ExecApprovalQuickMode: String, CaseIterable, Identifiable {
    case deny
    case ask
    case allow

    var id: String {
        self.rawValue
    }

    var title: String {
        switch self {
        case .deny: "Deny"
        case .ask: "Always Ask"
        case .allow: "Always Allow"
        }
    }

    var security: ExecSecurity {
        switch self {
        case .deny: .deny
        case .ask: .allowlist
        case .allow: .full
        }
    }

    var ask: ExecAsk {
        switch self {
        case .deny: .off
        case .ask: .onMiss
        case .allow: .off
        }
    }

    static func from(security: ExecSecurity, ask: ExecAsk) -> ExecApprovalQuickMode {
        switch security {
        case .deny:
            .deny
        case .full:
            .allow
        case .allowlist:
            .ask
        }
    }
}

enum ExecAsk: String, CaseIterable, Codable, Identifiable {
    case off
    case onMiss = "on-miss"
    case always

    var id: String {
        self.rawValue
    }

    var title: String {
        switch self {
        case .off: "Never Ask"
        case .onMiss: "Ask on Allowlist Miss"
        case .always: "Always Ask"
        }
    }
}

enum ExecApprovalDecision: String, Codable, Sendable {
    case allowOnce = "allow-once"
    case allowAlways = "allow-always"
    case deny
}

enum ExecAllowlistPatternValidationReason: String, Codable, Sendable, Equatable {
    case empty
    case missingPathComponent

    var message: String {
        switch self {
        case .empty:
            "Pattern cannot be empty."
        case .missingPathComponent:
            "Path patterns only. Include '/', '~', or '\\\\'."
        }
    }
}

enum ExecAllowlistPatternValidation: Sendable, Equatable {
    case valid(String)
    case invalid(ExecAllowlistPatternValidationReason)
}

struct ExecAllowlistRejectedEntry: Sendable, Equatable {
    let id: UUID
    let pattern: String
    let reason: ExecAllowlistPatternValidationReason
}

struct ExecAllowlistEntry: Codable, Hashable, Identifiable {
    var id: UUID
    var pattern: String
    var lastUsedAt: Double?
    var lastUsedCommand: String?
    var lastResolvedPath: String?

    init(
        id: UUID = UUID(),
        pattern: String,
        lastUsedAt: Double? = nil,
        lastUsedCommand: String? = nil,
        lastResolvedPath: String? = nil)
    {
        self.id = id
        self.pattern = pattern
        self.lastUsedAt = lastUsedAt
        self.lastUsedCommand = lastUsedCommand
        self.lastResolvedPath = lastResolvedPath
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case pattern
        case lastUsedAt
        case lastUsedCommand
        case lastResolvedPath
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        self.pattern = try container.decode(String.self, forKey: .pattern)
        self.lastUsedAt = try container.decodeIfPresent(Double.self, forKey: .lastUsedAt)
        self.lastUsedCommand = try container.decodeIfPresent(String.self, forKey: .lastUsedCommand)
        self.lastResolvedPath = try container.decodeIfPresent(String.self, forKey: .lastResolvedPath)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(self.id, forKey: .id)
        try container.encode(self.pattern, forKey: .pattern)
        try container.encodeIfPresent(self.lastUsedAt, forKey: .lastUsedAt)
        try container.encodeIfPresent(self.lastUsedCommand, forKey: .lastUsedCommand)
        try container.encodeIfPresent(self.lastResolvedPath, forKey: .lastResolvedPath)
    }
}

struct ExecApprovalsDefaults: Codable {
    var security: ExecSecurity?
    var ask: ExecAsk?
    var askFallback: ExecSecurity?
    var autoAllowSkills: Bool?
}

struct ExecApprovalsAgent: Codable {
    var security: ExecSecurity?
    var ask: ExecAsk?
    var askFallback: ExecSecurity?
    var autoAllowSkills: Bool?
    var allowlist: [ExecAllowlistEntry]?

    var isEmpty: Bool {
        self.security == nil && self.ask == nil && self.askFallback == nil && self
            .autoAllowSkills == nil && (self.allowlist?.isEmpty ?? true)
    }
}

struct ExecApprovalsSocketConfig: Codable {
    var path: String?
    var token: String?
}

struct ExecApprovalsFile: Codable {
    var version: Int
    var socket: ExecApprovalsSocketConfig?
    var defaults: ExecApprovalsDefaults?
    var agents: [String: ExecApprovalsAgent]?
}

struct ExecApprovalsSnapshot: Codable {
    var path: String
    var exists: Bool
    var hash: String
    var file: ExecApprovalsFile
}

struct ExecApprovalsResolved {
    let url: URL
    let socketPath: String
    let token: String
    let defaults: ExecApprovalsResolvedDefaults
    let agent: ExecApprovalsResolvedDefaults
    let allowlist: [ExecAllowlistEntry]
    var file: ExecApprovalsFile
}

struct ExecApprovalsResolvedDefaults {
    var security: ExecSecurity
    var ask: ExecAsk
    var askFallback: ExecSecurity
    var autoAllowSkills: Bool
}

enum ExecApprovalHelpers {
    static func validateAllowlistPattern(_ pattern: String?) -> ExecAllowlistPatternValidation {
        let trimmed = pattern?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !trimmed.isEmpty else { return .invalid(.empty) }
        guard self.containsPathComponent(trimmed) else { return .invalid(.missingPathComponent) }
        return .valid(trimmed)
    }

    static func isPathPattern(_ pattern: String?) -> Bool {
        switch self.validateAllowlistPattern(pattern) {
        case .valid:
            true
        case .invalid:
            false
        }
    }

    static func parseDecision(_ raw: String?) -> ExecApprovalDecision? {
        let trimmed = raw?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !trimmed.isEmpty else { return nil }
        return ExecApprovalDecision(rawValue: trimmed)
    }

    static func requiresAsk(
        ask: ExecAsk,
        security: ExecSecurity,
        allowlistMatch: ExecAllowlistEntry?,
        skillAllow: Bool) -> Bool
    {
        if ask == .always { return true }
        if ask == .onMiss, security == .allowlist, allowlistMatch == nil, !skillAllow { return true }
        return false
    }

    static func allowlistPattern(command: [String], resolution: ExecCommandResolution?) -> String? {
        let pattern = resolution?.resolvedPath ?? resolution?.rawExecutable ?? command.first ?? ""
        return pattern.isEmpty ? nil : pattern
    }

    private static func containsPathComponent(_ pattern: String) -> Bool {
        pattern.contains("/") || pattern.contains("~") || pattern.contains("\\")
    }
}

struct ExecEventPayload: Codable, Sendable {
    var sessionKey: String
    var runId: String
    var host: String
    var command: String?
    var exitCode: Int?
    var timedOut: Bool?
    var success: Bool?
    var output: String?
    var reason: String?

    static func truncateOutput(_ raw: String, maxChars: Int = 20000) -> String? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if trimmed.count <= maxChars { return trimmed }
        let suffix = trimmed.suffix(maxChars)
        return "... (truncated) \(suffix)"
    }
}

actor SkillBinsCache {
    static let shared = SkillBinsCache()

    private var bins: Set<String> = []
    private var lastRefresh: Date?
    private let refreshInterval: TimeInterval = 90

    func currentBins(force: Bool = false) async -> Set<String> {
        if force || self.isStale() {
            await self.refresh()
        }
        return self.bins
    }

    func refresh() async {
        do {
            let report = try await GatewayConnection.shared.skillsStatus()
            var next = Set<String>()
            for skill in report.skills {
                for bin in skill.requirements.bins {
                    let trimmed = bin.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !trimmed.isEmpty { next.insert(trimmed) }
                }
            }
            self.bins = next
            self.lastRefresh = Date()
        } catch {
            if self.lastRefresh == nil {
                self.bins = []
            }
        }
    }

    private func isStale() -> Bool {
        guard let lastRefresh else { return true }
        return Date().timeIntervalSince(lastRefresh) > self.refreshInterval
    }
}
