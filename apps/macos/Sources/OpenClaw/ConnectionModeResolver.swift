import Foundation

enum EffectiveConnectionModeSource: Sendable, Equatable {
    case configMode
    case configRemoteURL
    case userDefaults
    case onboarding
}

struct EffectiveConnectionMode: Sendable, Equatable {
    let mode: AppState.ConnectionMode
    let source: EffectiveConnectionModeSource
}

enum ConnectionModeResolver {
    static func resolve(
        root: [String: Any],
        defaults: UserDefaults = AppDefaults.standard) -> EffectiveConnectionMode
    {
        let gateway = root["gateway"] as? [String: Any]
        let configModeRaw = (gateway?["mode"] as? String) ?? ""
        let configMode = configModeRaw
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()

        switch configMode {
        case "local":
            return EffectiveConnectionMode(mode: .local, source: .configMode)
        case "remote":
            return EffectiveConnectionMode(mode: .remote, source: .configMode)
        default:
            break
        }

        if GatewayRemoteConfig.resolveUrlString(root: root) != nil {
            return EffectiveConnectionMode(mode: .remote, source: .configRemoteURL)
        }

        if let storedModeRaw = defaults.string(forKey: connectionModeKey) {
            let storedMode = AppState.ConnectionMode(rawValue: storedModeRaw) ?? .local
            return EffectiveConnectionMode(mode: storedMode, source: .userDefaults)
        }

        let seen = defaults.bool(forKey: "paleoclaw.onboardingSeen")
        return EffectiveConnectionMode(mode: seen ? .local : .unconfigured, source: .onboarding)
    }
}
