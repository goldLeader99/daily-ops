"""Inspect an advertised UPnP WAN service. This tool cannot change gateway settings."""

import argparse
import ipaddress
import json
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

MAX_XML_BYTES = 262144
READ_ACTIONS = {"GetCommonLinkProperties", "GetTotalBytesReceived", "GetTotalBytesSent"}


def same_gateway_url(base, reference, gateway):
    url = urllib.parse.urljoin(base, reference)
    parsed = urllib.parse.urlsplit(url)
    if (
        parsed.scheme not in {"http", "https"}
        or parsed.hostname != gateway
        or parsed.username is not None
        or parsed.password is not None
        or parsed.fragment
    ):
        raise ValueError("The advertised endpoint is not on the selected gateway.")
    return url


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def read_xml(url, body=None, headers=None):
    request = urllib.request.Request(url, data=body, headers=headers or {})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    with opener.open(request, timeout=5) as response:
        raw = response.read(MAX_XML_BYTES + 1)
    if len(raw) > MAX_XML_BYTES or b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():
        raise ValueError("Unsafe or oversized gateway XML response.")
    return ET.fromstring(raw)


def discover(gateway):
    query = (
        'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\n'
        'MAN: "ssdp:discover"\r\nMX: 2\r\n'
        'ST: urn:schemas-upnp-org:device:InternetGatewayDevice:1\r\n\r\n'
    ).encode("ascii")
    descriptions = set()
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP) as sock:
        sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)
        sock.settimeout(0.5)
        sock.sendto(query, ("239.255.255.250", 1900))
        deadline = time.monotonic() + 4
        while time.monotonic() < deadline:
            try:
                raw, address = sock.recvfrom(8192)
            except socket.timeout:
                continue
            if address[0] != gateway:
                continue
            headers = {}
            for line in raw.decode("iso-8859-1").splitlines()[1:]:
                if ":" in line:
                    key, value = line.split(":", 1)
                    headers[key.lower().strip()] = value.strip()
            if headers.get("location"):
                descriptions.add(same_gateway_url(headers["location"], "", gateway))
    return sorted(descriptions)


def wan_service(description, description_url, gateway):
    base = description.findtext("{*}URLBase") or description_url
    same_gateway_url(base, "", gateway)
    for service in description.findall(".//{*}service"):
        service_type = service.findtext("{*}serviceType") or ""
        if service_type not in {
            "urn:schemas-upnp-org:service:WANCommonInterfaceConfig:1",
            "urn:schemas-upnp-org:service:WANCommonInterfaceConfig:2",
        }:
            continue
        control = service.findtext("{*}controlURL")
        scpd = service.findtext("{*}SCPDURL")
        if control and scpd:
            return {
                "serviceType": service_type,
                "controlURL": same_gateway_url(base, control, gateway),
                "descriptionURL": same_gateway_url(base, scpd, gateway),
            }
    return None


def advertised_actions(description):
    return {
        action.findtext("{*}name")
        for action in description.findall(".//{*}action")
        if action.findtext("{*}name")
    }


def read_action(service, action, actions):
    if action not in READ_ACTIONS or action not in actions:
        raise ValueError("Only advertised, read-only WAN getters may be called.")
    envelope = ET.Element(
        "{http://schemas.xmlsoap.org/soap/envelope/}Envelope",
        {"{http://schemas.xmlsoap.org/soap/envelope/}encodingStyle":
         "http://schemas.xmlsoap.org/soap/encoding/"},
    )
    body = ET.SubElement(envelope, "{http://schemas.xmlsoap.org/soap/envelope/}Body")
    ET.SubElement(body, "{" + service["serviceType"] + "}" + action)
    response = read_xml(
        service["controlURL"],
        ET.tostring(envelope, encoding="utf-8", xml_declaration=True),
        {"Content-Type": 'text/xml; charset="utf-8"',
         "SOAPAction": '"' + service["serviceType"] + "#" + action + '"'},
    )
    result = response.find(".//{*}" + action + "Response")
    if result is None:
        raise ValueError("The gateway did not return the requested WAN reading.")
    return {element.tag.split("}")[-1]: element.text or "" for element in result}


def counter(raw):
    if not isinstance(raw, str) or not raw.isascii() or not raw.isdecimal() or len(raw) > 20:
        raise ValueError("The gateway did not return an unsigned byte counter.")
    value = int(raw)
    if value > 18446744073709551615:
        raise ValueError("The gateway counter exceeds 64 bits.")
    return value


def probe(gateway, count, interval):
    locations = discover(gateway)
    if not locations:
        print(json.dumps({"state": "no-advertised-gateway-service"}), flush=True)
        return 2
    for location in locations:
        service = wan_service(read_xml(location), location, gateway)
        if service is None:
            continue
        actions = advertised_actions(read_xml(service["descriptionURL"]))
        required = {"GetTotalBytesReceived", "GetTotalBytesSent"}
        if not required.issubset(actions):
            print(json.dumps({"state": "WAN-counters-not-advertised"}), flush=True)
            continue
        properties = {}
        if "GetCommonLinkProperties" in actions:
            properties = read_action(service, "GetCommonLinkProperties", actions)
        print(json.dumps({
            "state": "WAN-counter-service-found", "deviceDescriptionURL": location, "service": service,
            "accessType": properties.get("NewWANAccessType"),
            "linkStatus": properties.get("NewPhysicalLinkStatus"),
        }), flush=True)
        previous = None
        for index in range(count):
            started = time.monotonic()
            received = counter(read_action(service, "GetTotalBytesReceived", actions)
                               .get("NewTotalBytesReceived"))
            sent = counter(read_action(service, "GetTotalBytesSent", actions)
                           .get("NewTotalBytesSent"))
            observed = (started + time.monotonic()) / 2
            result = {"receivedBytes": str(received), "sentBytes": str(sent),
                      "sampleDurationMs": round((time.monotonic() - started) * 1000)}
            if previous and received >= previous[1] and sent >= previous[2]:
                elapsed = observed - previous[0]
                result.update({"intervalSeconds": elapsed,
                               "downloadMbps": (received - previous[1]) * 8 / elapsed / 1000000,
                               "uploadMbps": (sent - previous[2]) * 8 / elapsed / 1000000})
            else:
                result["state"] = "waiting-for-baseline" if previous is None else "counter-reset"
            print(json.dumps(result), flush=True)
            previous = (observed, received, sent)
            if index + 1 < count:
                time.sleep(max(0, interval - (time.monotonic() - started)))
        return 0
    return 3


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gateway", default="10.0.0.1")
    parser.add_argument("--count", type=int, default=4)
    parser.add_argument("--interval", type=float, default=2)
    args = parser.parse_args()
    address = ipaddress.ip_address(args.gateway)
    if address.version != 4 or not address.is_private or address.is_loopback:
        parser.error("Choose the private IPv4 address of the gateway.")
    if not 2 <= args.count <= 10 or not 1 <= args.interval <= 10:
        parser.error("Use 2–10 samples and a 1–10 second interval.")
    try:
        return probe(str(address), args.count, args.interval)
    except (OSError, ValueError, ET.ParseError, urllib.error.URLError) as error:
        print(json.dumps({"state": "probe-failed", "reason": str(error)}), flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
