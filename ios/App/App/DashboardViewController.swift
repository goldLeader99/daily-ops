import Capacitor
import UIKit
import WebKit
import Security

// A narrow prompt bridge preserves the existing synchronous repository contract.
// Writes complete atomically before JavaScript can acknowledge a successful save.
final class DashboardViewController: CAPBridgeViewController {
    private var storageDelegate: DashboardStorageDelegate?

    override func capacitorDidLoad() {
        guard let webView = webView else { return }
        let delegate = DashboardStorageDelegate(original: webView.uiDelegate)
        storageDelegate = delegate
        webView.uiDelegate = delegate
        let script = """
        if (location.origin === 'capacitor://localhost') {
          const invoke = (action, value = '') => {
            const raw = prompt('daily-ops-storage:' + action, value);
            if (raw === null) throw new Error('App storage bridge is unavailable.');
            const result = JSON.parse(raw);
            if (result.error) throw new Error(result.error);
            return result.value;
          };
          Object.defineProperty(window, 'DailyOpsStorage', { value: Object.freeze({
            read: () => invoke('read'),
            write: (value) => invoke('write', value)
          }) });
          Object.defineProperty(window, 'DailyOpsSyncStorage', { value: Object.freeze({
            readSession: () => invoke('read-session'),
            writeSession: (value) => invoke('write-session', value ?? ''),
            preserveBackup: (value) => invoke('preserve-backup', value),
            readBackup: () => invoke('read-backup')
          }) });
        }
        """
        webView.configuration.userContentController.addUserScript(
            WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        bridge?.registerPluginInstance(DashboardDevicePlugin())
        bridge?.registerPluginInstance(DashboardWanPlugin())
    }
}

final class DashboardStorageDelegate: NSObject, WKUIDelegate {
    private let original: WKUIDelegate?
    init(original: WKUIDelegate?) { self.original = original }

    override func responds(to selector: Selector!) -> Bool {
        super.responds(to: selector) || (original?.responds(to: selector) ?? false)
    }
    override func forwardingTarget(for selector: Selector!) -> Any? { original }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        guard prompt.hasPrefix("daily-ops-storage:") else {
            if let original = original {
                original.webView?(webView, runJavaScriptTextInputPanelWithPrompt: prompt,
                                  defaultText: defaultText, initiatedByFrame: frame,
                                  completionHandler: completionHandler)
            } else { completionHandler(nil) }
            return
        }
        guard frame.isMainFrame, frame.securityOrigin.protocol == "capacitor",
              frame.securityOrigin.host == "localhost" else {
            completionHandler(nil)
            return
        }
        var result: [String: Any]
        do {
            let directory = try FileManager.default.url(for: .applicationSupportDirectory,
                in: .userDomainMask, appropriateFor: nil, create: true)
            let file = directory.appendingPathComponent("daily-ops-v1.json")
            switch prompt {
            case "daily-ops-storage:read":
                if FileManager.default.fileExists(atPath: file.path) {
                    result = ["value": try String(contentsOf: file, encoding: .utf8)]
                } else { result = ["value": NSNull()] }
            case "daily-ops-storage:write":
                guard let text = defaultText, let data = text.data(using: .utf8) else {
                    throw NSError(domain: "DailyOps", code: 1)
                }
                try data.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
                result = ["value": true]
            case "daily-ops-storage:read-session":
                result = ["value": try readSession() as Any? ?? NSNull()]
            case "daily-ops-storage:write-session":
                guard let text = defaultText, text.utf8.count <= 100_000 else {
                    throw NSError(domain: "DailyOps", code: 2)
                }
                try writeSession(text.isEmpty ? nil : text)
                result = ["value": true]
            case "daily-ops-storage:preserve-backup":
                let backup = directory.appendingPathComponent("daily-ops-before-sync-v1.json")
                if !FileManager.default.fileExists(atPath: backup.path) {
                    guard let text = defaultText, let data = text.data(using: .utf8), data.count <= 4_000_000 else {
                        throw NSError(domain: "DailyOps", code: 3)
                    }
                    try data.write(to: backup, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
                }
                result = ["value": true]
            case "daily-ops-storage:read-backup":
                let backup = directory.appendingPathComponent("daily-ops-before-sync-v1.json")
                result = ["value": FileManager.default.fileExists(atPath: backup.path)
                    ? try String(contentsOf: backup, encoding: .utf8) : NSNull()]
            default: result = ["error": "Unsupported storage operation."]
            }
        } catch {
            result = ["error": "Could not access app storage. Free device space and retry; your saved copy has not been reset."]
        }
        let data = try? JSONSerialization.data(withJSONObject: result)
        completionHandler(data.flatMap { String(data: $0, encoding: .utf8) })
    }

    private var sessionQuery: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: "com.dailyops.dashboard.sync",
         kSecAttrAccount as String: "supabase-session-v1"]
    }
    private func readSession() throws -> String? {
        var query = sessionQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = item as? Data,
              let text = String(data: data, encoding: .utf8) else {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
        }
        return text
    }
    private func writeSession(_ text: String?) throws {
        guard let text = text else {
            let status = SecItemDelete(sessionQuery as CFDictionary)
            guard status == errSecSuccess || status == errSecItemNotFound else {
                throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
            }
            return
        }
        let attributes: [String: Any] = [
            kSecValueData as String: Data(text.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        var status = SecItemUpdate(sessionQuery as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            status = SecItemAdd(sessionQuery.merging(attributes) { _, new in new } as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw NSError(domain: NSOSStatusErrorDomain, code: Int(status)) }
    }
}

@objc(DashboardDevicePlugin)
final class DashboardDevicePlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    let identifier = "DashboardDevicePlugin"
    let jsName = "DashboardDevice"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "fullscreen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openLink", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exportBackup", returnType: CAPPluginReturnPromise)
    ]
    private var exportCall: CAPPluginCall?
    private var exportFile: URL?

    @objc func fullscreen(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let controller = self.bridge?.viewController as? CAPBridgeViewController else {
                call.reject("Display controls are unavailable."); return
            }
            controller.isStatusBarVisible.toggle()
            controller.setNeedsStatusBarAppearanceUpdate()
            call.resolve()
        }
    }

    @objc func openLink(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let url = URL(string: raw),
              ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
              url.host != nil, url.user == nil, url.password == nil else {
            call.reject("Only safe HTTP or HTTPS links are supported."); return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { opened in
                if opened { call.resolve() } else { call.reject("Could not open this link.") }
            }
        }
    }

    @objc func exportBackup(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.exportCall == nil else { call.reject("A backup export is already open."); return }
            guard let content = call.getString("content"),
                  let name = call.getString("filename"), name.hasSuffix(".json"),
                  name == URL(fileURLWithPath: name).lastPathComponent,
                  let controller = self.bridge?.viewController else {
                call.reject("Could not prepare the backup."); return
            }
            do {
                let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                let file = directory.appendingPathComponent(name)
                try Data(content.utf8).write(to: file, options: .atomic)
                self.exportFile = file
                self.exportCall = call
                let picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true)
                picker.delegate = self
                controller.present(picker, animated: true)
            } catch { call.reject("Could not create the backup file.") }
        }
    }
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        finishExport(saved: !urls.isEmpty)
    }
    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { finishExport(saved: false) }
    private func finishExport(saved: Bool) {
        exportCall?.resolve(["saved": saved])
        exportCall = nil
        if let file = exportFile { try? FileManager.default.removeItem(at: file.deletingLastPathComponent()) }
        exportFile = nil
    }
}
