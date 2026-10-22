// swift-tools-version: 6.2
// Package manifest for the paleoclaw macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "paleoclaw",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "OpenClawIPC", targets: ["OpenClawIPC"]),
        .library(name: "OpenClawDiscovery", targets: ["OpenClawDiscovery"]),
        .executable(name: "paleoclaw", targets: ["paleoclaw"]),
        .executable(name: "paleoclaw-mac", targets: ["OpenClawMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.2.2"),
        .package(url: "https://github.com/sindresorhus/KeyboardShortcuts", exact: "3.1.0"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "1.0.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.15.1"),
        .package(url: "https://github.com/sparkle-project/Sparkle", exact: "2.10.0"),
        // Peekaboo and the AXorcist it pulls in are external repositories. Their
        // coordinates must not follow this fork's brand, or the package graph
        // cannot be resolved at all.
        .package(url: "https://github.com/openclaw/Peekaboo.git", exact: "4.9.5"),
        .package(url: "https://github.com/pointfreeco/swift-concurrency-extras", from: "1.4.1"),
        .package(path: "../shared/OpenClawKit"),
        .package(path: "../shared/OpenClawMLXTTSProtocol"),
        .package(path: "../swabble"),
    ],
    targets: [
        .target(
            name: "OpenClawCameraPTZNative",
            path: "Sources/OpenClawCameraPTZNative",
            publicHeadersPath: "include",
            linkerSettings: [
                .linkedFramework("CoreFoundation"),
                .linkedFramework("IOKit"),
            ]),
        .target(
            name: "OpenClawIPC",
            dependencies: [.product(name: "OpenClawNativeState", package: "OpenClawKit")],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "OpenClawDiscovery",
            dependencies: [
                .product(name: "OpenClawKit", package: "OpenClawKit"),
                .product(name: "Subprocess", package: "swift-subprocess"),
            ],
            path: "Sources/OpenClawDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "paleoclaw",
            dependencies: [
                "OpenClawIPC",
                "OpenClawDiscovery",
                "OpenClawCameraPTZNative",
                .product(name: "OpenClawNativeState", package: "OpenClawKit"),
                .product(name: "OpenClawKit", package: "OpenClawKit"),
                .product(name: "OpenClawChatUI", package: "OpenClawKit"),
                .product(name: "OpenClawMLXTTSProtocol", package: "OpenClawMLXTTSProtocol"),
                .product(name: "OpenClawProtocol", package: "OpenClawKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
                .product(name: "ConcurrencyExtras", package: "swift-concurrency-extras"),
                .product(name: "KeyboardShortcuts", package: "KeyboardShortcuts"),
            ],
            path: "Sources/OpenClaw",
            exclude: [
                "Resources/Info.plist",
                "Resources/Localizable.xcstrings",
            ],
            resources: [
                .copy("Resources/paleoclaw.icns"),
                .copy("Resources/NativeSessionCatalogs.json"),
                .copy("Resources/AppIcons"),
                .copy("Resources/DeviceModels"),
                .copy("Resources/ProviderIcons"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "OpenClawMacCLI",
            dependencies: [
                "OpenClawIPC",
                "OpenClawDiscovery",
                .product(name: "OpenClawNativeState", package: "OpenClawKit"),
                .product(name: "OpenClawKit", package: "OpenClawKit"),
                .product(name: "OpenClawProtocol", package: "OpenClawKit"),
            ],
            path: "Sources/OpenClawMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "OpenClawWebKitTestSupport",
            path: "Tests/OpenClawWebKitTestSupport",
            publicHeadersPath: "include",
            linkerSettings: [
                .linkedFramework("WebKit"),
            ]),
        .testTarget(
            name: "OpenClawIPCTests",
            dependencies: [
                "OpenClawIPC",
                "OpenClawWebKitTestSupport",
                "paleoclaw",
                "OpenClawMacCLI",
                "OpenClawDiscovery",
                .product(name: "OpenClawNativeState", package: "OpenClawKit"),
                .product(name: "OpenClawChatUI", package: "OpenClawKit"),
                .product(name: "OpenClawKit", package: "OpenClawKit"),
                .product(name: "OpenClawMLXTTSProtocol", package: "OpenClawMLXTTSProtocol"),
                .product(name: "OpenClawProtocol", package: "OpenClawKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
