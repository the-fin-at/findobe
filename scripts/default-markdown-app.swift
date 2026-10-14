// Local, explicit opt-in only. The installer never changes defaults on its own.
import AppKit
import CoreServices
import UniformTypeIdentifiers
let app = URL(fileURLWithPath: "/Applications/FinDobe.app")
let type = "net.daringfireball.markdown" as CFString
if CommandLine.arguments.contains("--set") {
    let registration = LSRegisterURL(app as CFURL, true)
    guard registration == noErr else { fatalError("Registration failed: \(registration)") }
    NSWorkspace.shared.setDefaultApplication(at: app, toOpen: UTType("net.daringfireball.markdown")!) { error in
        if let error = error { fputs("Default association failed: \(error)\n", stderr); exit(1) }
        print("Markdown default updated.")
        exit(0)
    }
    RunLoop.main.run(until: Date(timeIntervalSinceNow: 60))
    fputs("No completion received; check for a macOS consent dialog.\n", stderr)
    exit(2)
}
let handler = LSCopyDefaultRoleHandlerForContentType(type, .all)?.takeRetainedValue()
print("Markdown handler: \(handler.map { $0 as String } ?? "none")")
let sample = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first { !$0.hasPrefix("--") } ?? "tests/demo.md")
print("Resolved app: \(NSWorkspace.shared.urlForApplication(toOpen: sample)?.path ?? "none")")
