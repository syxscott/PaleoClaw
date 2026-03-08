import Foundation

// Stable identifier used for both the macOS LaunchAgent label and Nix-managed defaults suite.
// nix-paleoclaw writes app defaults into this suite to survive app bundle identifier churn.
let launchdLabel = "ai.paleoclaw.mac"
let gatewayLaunchdLabel = "ai.paleoclaw.gateway"
let onboardingVersionKey = "paleoclaw.onboardingVersion"
let onboardingSeenKey = "paleoclaw.onboardingSeen"
let currentOnboardingVersion = 7
let pauseDefaultsKey = "paleoclaw.pauseEnabled"
let iconAnimationsEnabledKey = "paleoclaw.iconAnimationsEnabled"
let swabbleEnabledKey = "paleoclaw.swabbleEnabled"
let swabbleTriggersKey = "paleoclaw.swabbleTriggers"
let voiceWakeTriggerChimeKey = "paleoclaw.voiceWakeTriggerChime"
let voiceWakeSendChimeKey = "paleoclaw.voiceWakeSendChime"
let showDockIconKey = "paleoclaw.showDockIcon"
let defaultVoiceWakeTriggers = ["paleoclaw"]
let voiceWakeMaxWords = 32
let voiceWakeMaxWordLength = 64
let voiceWakeMicKey = "paleoclaw.voiceWakeMicID"
let voiceWakeMicNameKey = "paleoclaw.voiceWakeMicName"
let voiceWakeLocaleKey = "paleoclaw.voiceWakeLocaleID"
let voiceWakeAdditionalLocalesKey = "paleoclaw.voiceWakeAdditionalLocaleIDs"
let voicePushToTalkEnabledKey = "paleoclaw.voicePushToTalkEnabled"
let talkEnabledKey = "paleoclaw.talkEnabled"
let iconOverrideKey = "paleoclaw.iconOverride"
let connectionModeKey = "paleoclaw.connectionMode"
let remoteTargetKey = "paleoclaw.remoteTarget"
let remoteIdentityKey = "paleoclaw.remoteIdentity"
let remoteProjectRootKey = "paleoclaw.remoteProjectRoot"
let remoteCliPathKey = "paleoclaw.remoteCliPath"
let canvasEnabledKey = "paleoclaw.canvasEnabled"
let cameraEnabledKey = "paleoclaw.cameraEnabled"
let systemRunPolicyKey = "paleoclaw.systemRunPolicy"
let systemRunAllowlistKey = "paleoclaw.systemRunAllowlist"
let systemRunEnabledKey = "paleoclaw.systemRunEnabled"
let locationModeKey = "paleoclaw.locationMode"
let locationPreciseKey = "paleoclaw.locationPreciseEnabled"
let peekabooBridgeEnabledKey = "paleoclaw.peekabooBridgeEnabled"
let deepLinkKeyKey = "paleoclaw.deepLinkKey"
let modelCatalogPathKey = "paleoclaw.modelCatalogPath"
let modelCatalogReloadKey = "paleoclaw.modelCatalogReload"
let cliInstallPromptedVersionKey = "paleoclaw.cliInstallPromptedVersion"
let heartbeatsEnabledKey = "paleoclaw.heartbeatsEnabled"
let debugPaneEnabledKey = "paleoclaw.debugPaneEnabled"
let debugFileLogEnabledKey = "paleoclaw.debug.fileLogEnabled"
let appLogLevelKey = "paleoclaw.debug.appLogLevel"
let voiceWakeSupported: Bool = ProcessInfo.processInfo.operatingSystemVersion.majorVersion >= 26
