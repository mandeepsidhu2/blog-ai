import MacAgentFlowCore
import SwiftUI

struct AgentCanvasView: View {
    @EnvironmentObject private var store: WorkspaceStore
    @State private var connectionDrag: ConnectionDrag?
    @State private var nodeDragOffsets: [UUID: CGSize] = [:]

    private var canvasSize: CGSize {
        guard let agent = store.selectedAgent else { return CGSize(width: 1100, height: 660) }
        let maxX = agent.nodes.map { $0.position.x + $0.width }.max() ?? 1200
        let maxY = agent.nodes.map { $0.position.y + $0.height }.max() ?? 620
        return CGSize(width: max(maxX + 120, 1100), height: max(maxY + 140, 660))
    }

    var body: some View {
        ScrollView([.horizontal, .vertical]) {
            ZStack(alignment: .topLeading) {
                GridBackground(size: canvasSize)
                if let agent = store.selectedAgent {
                    let renderedAgent = displayedAgent(agent)
                    let highlight = highlightedPath(for: agent)
                    let nodesByID = Dictionary(uniqueKeysWithValues: renderedAgent.nodes.map { ($0.id, $0) })
                    EdgeLayer(agent: renderedAgent, highlightedEdgeIDs: highlight.edgeIDs, selectedEdgeID: store.selectedEdgeID)
                    if let connectionDrag {
                        ConnectionPreviewLayer(drag: connectionDrag)
                            .frame(width: canvasSize.width, height: canvasSize.height)
                    }
                    ForEach(agent.nodes) { node in
                        NodeCard(
                            node: node,
                            isSelected: store.selectedNodeID == node.id,
                            isRunHighlighted: highlight.nodeIDs.contains(node.id),
                            dragOffset: nodeDragOffsets[node.id] ?? .zero,
                            onDragChanged: { nodeID, translation in
                                nodeDragOffsets[nodeID] = translation
                            },
                            onDragEnded: { nodeID, translation in
                                store.setNodePosition(
                                    nodeID,
                                    position: CanvasPoint(
                                        x: node.position.x + translation.width,
                                        y: node.position.y + translation.height
                                    )
                                )
                                nodeDragOffsets[nodeID] = nil
                                store.persist()
                            }
                        )
                            .position(x: node.position.x + node.width / 2, y: node.position.y + node.height / 2)
                    }
                    ForEach(renderedAgent.nodes) { node in
                        ForEach(NodePort.allCases) { port in
                            ConnectionPortHandle(
                                nodeID: node.id,
                                port: port,
                                point: portPoint(for: node, port: port),
                                isActive: connectionDrag?.movingPoint.distance(to: portPoint(for: node, port: port)) ?? .infinity < 30,
                                onChanged: beginOrUpdatePortDrag,
                                onEnded: finishPortDrag
                            )
                        }
                    }
                    ForEach(renderedAgent.edges) { edge in
                        if let geometry = edgeGeometry(for: edge, nodesByID: nodesByID) {
                            EdgeMidpointHandle(
                                edgeID: edge.id,
                                point: geometry.midpoint,
                                isSelected: store.selectedEdgeID == edge.id,
                                onSelect: store.selectEdge,
                                onDelete: store.deleteEdge
                            )
                            EdgeEndpointHandle(
                                edgeID: edge.id,
                                endpoint: .source,
                                point: geometry.start,
                                fixedPoint: geometry.end,
                                isSelected: store.selectedEdgeID == edge.id,
                                onSelect: store.selectEdge,
                                onDelete: store.deleteEdge,
                                onChanged: beginOrUpdateEndpointDrag,
                                onEnded: finishEndpointDrag
                            )
                            EdgeEndpointHandle(
                                edgeID: edge.id,
                                endpoint: .target,
                                point: geometry.end,
                                fixedPoint: geometry.start,
                                isSelected: store.selectedEdgeID == edge.id,
                                onSelect: store.selectEdge,
                                onDelete: store.deleteEdge,
                                onChanged: beginOrUpdateEndpointDrag,
                                onEnded: finishEndpointDrag
                            )
                        }
                    }
                }
            }
            .frame(width: canvasSize.width, height: canvasSize.height)
        }
        .background(Color(nsColor: .textBackgroundColor))
    }

    private func displayedAgent(_ agent: AgentDefinition) -> AgentDefinition {
        var rendered = agent
        for index in rendered.nodes.indices {
            guard let offset = nodeDragOffsets[rendered.nodes[index].id] else { continue }
            rendered.nodes[index].position.x += offset.width
            rendered.nodes[index].position.y += offset.height
        }
        return rendered
    }

    private func highlightedPath(for agent: AgentDefinition) -> HighlightedPath {
        guard let run = store.selectedRun else { return HighlightedPath() }
        let titles = run.logLines.compactMap { line -> String? in
            guard let title = line.split(separator: ":", maxSplits: 1).first else { return nil }
            return String(title).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        let nodeIDs = titles.compactMap { title in
            agent.nodes.first { $0.title == title }?.id
        }
        var edgeIDs: Set<UUID> = []
        for index in nodeIDs.indices.dropLast() {
            let from = nodeIDs[index]
            let to = nodeIDs[index + 1]
            if let edge = agent.edges.first(where: { $0.from == from && $0.to == to }) {
                edgeIDs.insert(edge.id)
            }
        }
        return HighlightedPath(nodeIDs: Set(nodeIDs), edgeIDs: edgeIDs)
    }

    private func beginOrUpdatePortDrag(selection: ConnectionPortSelection, startPoint: CGPoint, currentPoint: CGPoint) {
        store.selectNode(selection.nodeID)
        if connectionDrag == nil {
            connectionDrag = ConnectionDrag(kind: .create(selection), fixedPoint: startPoint, movingPoint: currentPoint)
        } else {
            connectionDrag?.movingPoint = currentPoint
        }
    }

    private func finishPortDrag(selection: ConnectionPortSelection, currentPoint: CGPoint) {
        guard let agent = store.selectedAgent,
              let target = nearestPort(to: currentPoint, in: agent, excluding: selection),
              target.nodeID != selection.nodeID else {
            connectionDrag = nil
            return
        }
        store.connect(from: selection, to: target)
        connectionDrag = nil
    }

    private func beginOrUpdateEndpointDrag(edgeID: UUID, endpoint: ConnectionEndpoint, fixedPoint: CGPoint, currentPoint: CGPoint) {
        store.selectEdge(edgeID)
        if connectionDrag == nil {
            connectionDrag = ConnectionDrag(kind: .reconnect(edgeID: edgeID, endpoint: endpoint), fixedPoint: fixedPoint, movingPoint: currentPoint)
        } else {
            connectionDrag?.movingPoint = currentPoint
        }
    }

    private func finishEndpointDrag(edgeID: UUID, endpoint: ConnectionEndpoint, currentPoint: CGPoint) {
        guard let agent = store.selectedAgent,
              let target = nearestPort(to: currentPoint, in: agent) else {
            store.deleteEdge(edgeID)
            connectionDrag = nil
            return
        }
        store.reconnectEdge(edgeID, endpoint: endpoint, to: target)
        connectionDrag = nil
    }

    private func nearestPort(to point: CGPoint, in agent: AgentDefinition, excluding excluded: ConnectionPortSelection? = nil) -> ConnectionPortSelection? {
        var best: (selection: ConnectionPortSelection, distance: CGFloat)?
        for node in agent.nodes {
            for port in NodePort.allCases {
                let selection = ConnectionPortSelection(nodeID: node.id, port: port)
                if selection == excluded { continue }
                let distance = point.distance(to: portPoint(for: node, port: port))
                if distance <= 34, best == nil || distance < best!.distance {
                    best = (selection, distance)
                }
            }
        }
        return best?.selection
    }
}

struct HighlightedPath {
    var nodeIDs: Set<UUID> = []
    var edgeIDs: Set<UUID> = []
}

struct GridBackground: View {
    let size: CGSize

    var body: some View {
        Canvas { context, _ in
            let spacing: CGFloat = 24
            var path = Path()
            var x: CGFloat = 0
            while x <= size.width {
                path.move(to: CGPoint(x: x, y: 0))
                path.addLine(to: CGPoint(x: x, y: size.height))
                x += spacing
            }
            var y: CGFloat = 0
            while y <= size.height {
                path.move(to: CGPoint(x: 0, y: y))
                path.addLine(to: CGPoint(x: size.width, y: y))
                y += spacing
            }
            context.stroke(path, with: .color(Color.secondary.opacity(0.07)), lineWidth: 1)
        }
        .frame(width: size.width, height: size.height)
    }
}

struct EdgeLayer: View {
    let agent: AgentDefinition
    let highlightedEdgeIDs: Set<UUID>
    let selectedEdgeID: UUID?

    var nodesByID: [UUID: AgentNode] {
        Dictionary(uniqueKeysWithValues: agent.nodes.map { ($0.id, $0) })
    }

    var body: some View {
        Canvas { context, _ in
            for edge in agent.edges {
                guard let geometry = edgeGeometry(for: edge, nodesByID: nodesByID) else { continue }
                let from = nodesByID[edge.from]
                let isHighlighted = highlightedEdgeIDs.contains(edge.id)
                let isSelected = selectedEdgeID == edge.id
                let path = connectorPath(from: geometry.start, fromPort: geometry.fromPort, to: geometry.end, toPort: geometry.toPort)
                let color: Color
                if isSelected {
                    color = Color.accentColor.opacity(0.92)
                } else if isHighlighted {
                    color = Color.green.opacity(0.90)
                } else {
                    color = from?.kind == .condition ? Color.orange.opacity(0.58) : Color.accentColor.opacity(0.46)
                }
                context.stroke(path, with: .color(color), style: StrokeStyle(lineWidth: isSelected || isHighlighted ? 3.2 : 2.0, lineCap: .round))

                let labelPoint = CGPoint(x: (geometry.start.x + geometry.end.x) / 2, y: (geometry.start.y + geometry.end.y) / 2 - 8)
                context.draw(
                    Text(edge.label)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary),
                    at: labelPoint
                )
            }
        }
    }
}

struct EdgeMidpointHandle: View {
    let edgeID: UUID
    let point: CGPoint
    let isSelected: Bool
    let onSelect: (UUID) -> Void
    let onDelete: (UUID) -> Void

    @State private var isHovering = false

    var body: some View {
        Circle()
            .fill(isSelected || isHovering ? Color.accentColor : Color.secondary.opacity(0.36))
            .frame(width: isSelected || isHovering ? 9 : 7, height: isSelected || isHovering ? 9 : 7)
            .overlay(Circle().stroke(Color.white.opacity(0.92), lineWidth: 1.5))
            .frame(width: 34, height: 34)
            .contentShape(Circle())
            .position(point)
            .help("Select connector. Press Delete to remove it.")
            .onHover { isHovering = $0 }
            .onTapGesture {
                onSelect(edgeID)
            }
            .contextMenu {
                Button("Delete Connector", role: .destructive) {
                    onDelete(edgeID)
                }
            }
            .zIndex(25)
    }
}

struct ConnectionPreviewLayer: View {
    let drag: ConnectionDrag

    var body: some View {
        Canvas { context, _ in
            var path = Path()
            path.move(to: drag.fixedPoint)
            let midY = (drag.fixedPoint.y + drag.movingPoint.y) / 2
            path.addCurve(
                to: drag.movingPoint,
                control1: CGPoint(x: drag.fixedPoint.x, y: midY),
                control2: CGPoint(x: drag.movingPoint.x, y: midY)
            )
            context.stroke(
                path,
                with: .color(Color.accentColor.opacity(0.78)),
                style: StrokeStyle(lineWidth: 2.4, lineCap: .round, dash: [7, 5])
            )
        }
        .allowsHitTesting(false)
    }
}

struct ConnectionPortHandle: View {
    let nodeID: UUID
    let port: NodePort
    let point: CGPoint
    let isActive: Bool
    let onChanged: (ConnectionPortSelection, CGPoint, CGPoint) -> Void
    let onEnded: (ConnectionPortSelection, CGPoint) -> Void

    var body: some View {
        Circle()
            .fill(isActive ? Color.accentColor : Color.teal.opacity(0.86))
            .frame(width: isActive ? 14 : 11, height: isActive ? 14 : 11)
            .overlay(Circle().stroke(Color.white.opacity(0.95), lineWidth: 2))
            .shadow(color: (isActive ? Color.accentColor : Color.teal).opacity(0.30), radius: 5)
            .frame(width: 34, height: 34)
            .contentShape(Circle())
            .position(point)
            .help("\(port.rawValue.capitalized) connector")
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        let current = CGPoint(x: point.x + value.translation.width, y: point.y + value.translation.height)
                        onChanged(ConnectionPortSelection(nodeID: nodeID, port: port), point, current)
                    }
                    .onEnded { value in
                        let current = CGPoint(x: point.x + value.translation.width, y: point.y + value.translation.height)
                        onEnded(ConnectionPortSelection(nodeID: nodeID, port: port), current)
                    }
            )
            .zIndex(20)
    }
}

struct EdgeEndpointHandle: View {
    let edgeID: UUID
    let endpoint: ConnectionEndpoint
    let point: CGPoint
    let fixedPoint: CGPoint
    let isSelected: Bool
    let onSelect: (UUID) -> Void
    let onDelete: (UUID) -> Void
    let onChanged: (UUID, ConnectionEndpoint, CGPoint, CGPoint) -> Void
    let onEnded: (UUID, ConnectionEndpoint, CGPoint) -> Void

    var body: some View {
        Circle()
            .fill(Color.white)
            .frame(width: isSelected ? 15 : 13, height: isSelected ? 15 : 13)
            .overlay(Circle().stroke(isSelected ? Color.accentColor : Color.accentColor.opacity(0.78), lineWidth: isSelected ? 3.5 : 2.5))
            .shadow(color: Color.accentColor.opacity(isSelected ? 0.36 : 0.22), radius: isSelected ? 6 : 4)
            .frame(width: 52, height: 52)
            .contentShape(Circle())
            .position(point)
            .help(endpoint == .source ? "Drag to reconnect source. Drop on empty canvas to disconnect." : "Drag to reconnect target. Drop on empty canvas to disconnect.")
            .gesture(
                DragGesture(minimumDistance: 2)
                    .onChanged { value in
                        onSelect(edgeID)
                        let current = CGPoint(x: point.x + value.translation.width, y: point.y + value.translation.height)
                        onChanged(edgeID, endpoint, fixedPoint, current)
                    }
                    .onEnded { value in
                        let current = CGPoint(x: point.x + value.translation.width, y: point.y + value.translation.height)
                        onEnded(edgeID, endpoint, current)
                    }
            )
            .simultaneousGesture(
                TapGesture().onEnded {
                    onSelect(edgeID)
                }
            )
            .contextMenu {
                Button("Delete Connector", role: .destructive) {
                    onDelete(edgeID)
                }
            }
            .zIndex(30)
    }
}

struct NodeCard: View {
    @EnvironmentObject private var store: WorkspaceStore

    let node: AgentNode
    let isSelected: Bool
    let isRunHighlighted: Bool
    let dragOffset: CGSize
    let onDragChanged: (UUID, CGSize) -> Void
    let onDragEnded: (UUID, CGSize) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: node.kind.symbolName)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(iconColor)
                    .frame(width: 24, height: 24)
                    .background(iconColor.opacity(0.12), in: RoundedRectangle(cornerRadius: 6))
                Text(node.title)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Spacer()
                Text(node.kind.title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                if isRunHighlighted {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.green)
                        .help("This node ran in the selected run")
                }
            }

            Text(node.note)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)

            HStack(spacing: 6) {
                if node.kind == .ai {
                    Pill(text: "\(node.selectedToolIDs.count) tools")
                } else if node.kind == .condition {
                    Pill(text: node.branches.joined(separator: ", "))
                } else if node.kind == .code {
                    Pill(text: "Python")
                }
                if isRunHighlighted {
                    Pill(text: "ran")
                }
                Spacer()
            }
        }
        .padding(11)
        .frame(width: node.width, height: node.height, alignment: .topLeading)
        .background(background)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(borderColor, lineWidth: borderWidth)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .shadow(color: shadowColor, radius: isSelected || isRunHighlighted ? 8 : 4, y: 2)
        .offset(dragOffset)
        .onTapGesture {
            store.selectNode(node.id)
        }
        .contextMenu {
            if ![AgentNodeKind.start, .end].contains(node.kind) {
                Button("Copy Node") {
                    store.selectNode(node.id)
                    store.copySelection()
                }
                Button("Duplicate Node") {
                    store.selectNode(node.id)
                    store.copySelection()
                    store.pasteSelection()
                }
                Button("Delete Node", role: .destructive) {
                    store.selectNode(node.id)
                    store.deleteSelectedNode()
                }
            }
        }
        .highPriorityGesture(
            DragGesture(minimumDistance: 3)
                .onChanged { value in
                    onDragChanged(node.id, value.translation)
                }
                .onEnded { value in
                    onDragEnded(node.id, value.translation)
                }
        )
    }

    private var iconColor: Color {
        switch node.kind {
        case .start, .end: .green
        case .ai: .purple
        case .code: .blue
        case .tool: .teal
        case .condition: .orange
        }
    }

    private var background: some ShapeStyle {
        if node.kind == .ai {
            return AnyShapeStyle(LinearGradient(colors: [Color.purple.opacity(0.16), Color(nsColor: .controlBackgroundColor)], startPoint: .topLeading, endPoint: .bottomTrailing))
        }
        return AnyShapeStyle(Color(nsColor: .controlBackgroundColor))
    }

    private var borderColor: Color {
        if isSelected { return .accentColor }
        if isRunHighlighted { return .green.opacity(0.75) }
        return Color.secondary.opacity(0.18)
    }

    private var borderWidth: CGFloat {
        isSelected || isRunHighlighted ? 1.5 : 1
    }

    private var shadowColor: Color {
        if isSelected { return Color.black.opacity(0.10) }
        if isRunHighlighted { return Color.green.opacity(0.16) }
        return Color.black.opacity(0.04)
    }
}

struct Pill: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .lineLimit(1)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(Color.secondary.opacity(0.12), in: Capsule())
            .foregroundStyle(.secondary)
    }
}

struct ConnectionDrag {
    enum Kind {
        case create(ConnectionPortSelection)
        case reconnect(edgeID: UUID, endpoint: ConnectionEndpoint)
    }

    let kind: Kind
    var fixedPoint: CGPoint
    var movingPoint: CGPoint
}

struct EdgeGeometry {
    let start: CGPoint
    let end: CGPoint
    let midpoint: CGPoint
    let fromPort: NodePort
    let toPort: NodePort
}

private func edgeGeometry(for edge: AgentEdge, nodesByID: [UUID: AgentNode]) -> EdgeGeometry? {
    guard let from = nodesByID[edge.from], let to = nodesByID[edge.to] else { return nil }
    let ports = resolvedPorts(for: edge, from: from, to: to)
    return EdgeGeometry(
        start: portPoint(for: from, port: ports.from),
        end: portPoint(for: to, port: ports.to),
        midpoint: connectorMidpoint(
            from: portPoint(for: from, port: ports.from),
            fromPort: ports.from,
            to: portPoint(for: to, port: ports.to),
            toPort: ports.to
        ),
        fromPort: ports.from,
        toPort: ports.to
    )
}

private func resolvedPorts(for edge: AgentEdge, from: AgentNode, to: AgentNode) -> (from: NodePort, to: NodePort) {
    if let fromPort = edge.fromPort, let toPort = edge.toPort {
        return (fromPort, toPort)
    }

    let fromCenter = CGPoint(x: from.position.x + from.width / 2, y: from.position.y + from.height / 2)
    let toCenter = CGPoint(x: to.position.x + to.width / 2, y: to.position.y + to.height / 2)
    let dx = toCenter.x - fromCenter.x
    let dy = toCenter.y - fromCenter.y
    if abs(dx) > abs(dy) {
        return dx >= 0 ? (.right, .left) : (.left, .right)
    }
    return dy >= 0 ? (.bottom, .top) : (.top, .bottom)
}

private func portPoint(for node: AgentNode, port: NodePort) -> CGPoint {
    switch port {
    case .top:
        return CGPoint(x: node.position.x + node.width / 2, y: node.position.y)
    case .right:
        return CGPoint(x: node.position.x + node.width, y: node.position.y + node.height / 2)
    case .bottom:
        return CGPoint(x: node.position.x + node.width / 2, y: node.position.y + node.height)
    case .left:
        return CGPoint(x: node.position.x, y: node.position.y + node.height / 2)
    }
}

private func connectorPath(from start: CGPoint, fromPort: NodePort, to end: CGPoint, toPort: NodePort) -> Path {
    let distance = start.distance(to: end)
    let offset = max(58, min(140, distance * 0.36))
    var path = Path()
    path.move(to: start)
    path.addCurve(
        to: end,
        control1: start.offset(by: fromPort.vector, distance: offset),
        control2: end.offset(by: toPort.vector, distance: offset)
    )
    return path
}

private func connectorMidpoint(from start: CGPoint, fromPort: NodePort, to end: CGPoint, toPort: NodePort) -> CGPoint {
    let distance = start.distance(to: end)
    let offset = max(58, min(140, distance * 0.36))
    let control1 = start.offset(by: fromPort.vector, distance: offset)
    let control2 = end.offset(by: toPort.vector, distance: offset)
    let t: CGFloat = 0.5
    let oneMinusT = 1 - t
    let oneMinusTSquared = oneMinusT * oneMinusT
    let oneMinusTCubed = oneMinusTSquared * oneMinusT
    let tSquared = t * t
    let tCubed = tSquared * t
    let x = oneMinusTCubed * start.x
        + 3 * oneMinusTSquared * t * control1.x
        + 3 * oneMinusT * tSquared * control2.x
        + tCubed * end.x
    let y = oneMinusTCubed * start.y
        + 3 * oneMinusTSquared * t * control1.y
        + 3 * oneMinusT * tSquared * control2.y
        + tCubed * end.y
    return CGPoint(x: x, y: y)
}

private extension NodePort {
    var vector: CGVector {
        switch self {
        case .top:
            return CGVector(dx: 0, dy: -1)
        case .right:
            return CGVector(dx: 1, dy: 0)
        case .bottom:
            return CGVector(dx: 0, dy: 1)
        case .left:
            return CGVector(dx: -1, dy: 0)
        }
    }
}

private extension CGPoint {
    func distance(to other: CGPoint) -> CGFloat {
        hypot(x - other.x, y - other.y)
    }

    func offset(by vector: CGVector, distance: CGFloat) -> CGPoint {
        CGPoint(x: x + vector.dx * distance, y: y + vector.dy * distance)
    }
}
