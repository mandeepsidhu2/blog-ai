// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "MacAgentFlow",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "MacAgentFlow", targets: ["MacAgentFlowApp"]),
        .executable(name: "MacAgentFlowChecks", targets: ["MacAgentFlowChecks"]),
        .library(name: "MacAgentFlowCore", targets: ["MacAgentFlowCore"])
    ],
    targets: [
        .target(
            name: "MacAgentFlowCore",
            path: "Sources/MacAgentFlowCore"
        ),
        .executableTarget(
            name: "MacAgentFlowApp",
            dependencies: ["MacAgentFlowCore"],
            path: "Sources/MacAgentFlowApp"
        ),
        .executableTarget(
            name: "MacAgentFlowChecks",
            dependencies: ["MacAgentFlowCore"],
            path: "Sources/MacAgentFlowChecks"
        )
    ]
)
