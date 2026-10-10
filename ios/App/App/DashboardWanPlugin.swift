import Capacitor
import Foundation

// Only private-gateway GETs and the three WAN getters are available to the web view.
// This session has no cookies, credentials, redirects, or gateway write operations.
@objc(DashboardWanPlugin)
final class DashboardWanPlugin: CAPPlugin, CAPBridgedPlugin, URLSessionTaskDelegate {
    let identifier = "DashboardWanPlugin"
    let jsName = "DashboardWan"
    let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise)]
    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieStorage = nil
        config.httpShouldSetCookies = false
        config.urlCredentialStorage = nil
        config.urlCache = nil
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.timeoutIntervalForRequest = 5
        config.timeoutIntervalForResource = 5
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    @objc func read(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let gateway = call.getString("gateway"),
              let url = URL(string: raw), privateIPv4(gateway), url.host == gateway,
              ["http", "https"].contains(url.scheme ?? ""),
              url.user == nil, url.password == nil, url.fragment == nil else {
            call.reject("Use a service address on your private home gateway."); return
        }
        var request = URLRequest(url: url)
        if let action = call.getString("action") {
            guard ["GetTotalBytesReceived", "GetTotalBytesSent", "GetCommonLinkProperties"].contains(action),
                  let type = call.getString("serviceType"),
                  ["urn:schemas-upnp-org:service:WANCommonInterfaceConfig:1",
                   "urn:schemas-upnp-org:service:WANCommonInterfaceConfig:2"].contains(type) else {
                call.reject("Only read-only WAN actions are supported."); return
            }
            request.httpMethod = "POST"
            request.setValue("text/xml; charset=utf-8", forHTTPHeaderField: "Content-Type")
            request.setValue("\"\(type)#\(action)\"", forHTTPHeaderField: "SOAPAction")
            let xml = """
            <?xml version="1.0"?>
            <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:\(action) xmlns:u="\(type)"/></s:Body></s:Envelope>
            """
            request.httpBody = Data(xml.utf8)
        }
        session.dataTask(with: request) { data, response, error in
            guard error == nil else {
                call.reject("Could not reach the gateway. Check Local Network access and the connection settings."); return
            }
            guard let response = response as? HTTPURLResponse, response.statusCode == 200,
                  response.url == url, let data = data, data.count <= 262144,
                  let xml = String(data: data, encoding: .utf8) else {
                call.reject("The gateway did not return a valid WAN service response."); return
            }
            call.resolve(["xml": xml])
        }.resume()
    }

    private func privateIPv4(_ value: String) -> Bool {
        let parts = value.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 4, parts.allSatisfy({ !$0.isEmpty && $0.utf8.allSatisfy({ $0 >= 48 && $0 <= 57 }) }),
              parts.allSatisfy({ Int($0) != nil && Int($0)! <= 255 }) else { return false }
        let values = parts.map { Int($0)! }
        return values[0] == 10 || (values[0] == 172 && (16...31).contains(values[1])) ||
            (values[0] == 192 && values[1] == 168)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}
