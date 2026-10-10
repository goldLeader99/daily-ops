import importlib.util
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location(
    "gateway_probe", Path(__file__).parents[1] / "scripts" / "probe_gateway.py"
)
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


class GatewayProbeTests(unittest.TestCase):
    def test_relative_advertised_endpoint_stays_on_gateway(self):
        self.assertEqual(
            probe.same_gateway_url("http://10.0.0.1:5000/root.xml", "/WAN/control", "10.0.0.1"),
            "http://10.0.0.1:5000/WAN/control",
        )

    def test_foreign_endpoint_and_embedded_credentials_are_rejected(self):
        for url in ["http://10.0.0.2/control", "http://example.com/control",
                    "http://admin:secret@10.0.0.1/control", "file:///tmp/control"]:
            with self.assertRaises(ValueError):
                probe.same_gateway_url("http://10.0.0.1/root.xml", url, "10.0.0.1")

    def test_namespaced_wan_service_and_relative_control_url(self):
        document = ET.fromstring('''
          <root xmlns="urn:schemas-upnp-org:device-1-0"><device><serviceList><service>
            <serviceType>urn:schemas-upnp-org:service:WANCommonInterfaceConfig:1</serviceType>
            <controlURL>/WAN/control</controlURL><SCPDURL>/WAN/scpd.xml</SCPDURL>
          </service></serviceList></device></root>''')
        service = probe.wan_service(document, "http://10.0.0.1:5000/root.xml", "10.0.0.1")
        self.assertEqual(service["controlURL"], "http://10.0.0.1:5000/WAN/control")

    def test_lan_service_does_not_become_a_wan_traffic_source(self):
        document = ET.fromstring('''<root><service>
          <serviceType>urn:schemas-upnp-org:service:LANHostConfigManagement:1</serviceType>
          <controlURL>/LAN/control</controlURL><SCPDURL>/LAN/scpd.xml</SCPDURL>
        </service></root>''')
        self.assertIsNone(probe.wan_service(document, "http://10.0.0.1/root.xml", "10.0.0.1"))

    def test_mutating_and_unadvertised_actions_are_blocked_before_any_request(self):
        for action, actions in [("AddPortMapping", {"AddPortMapping"}),
                                ("SetEnabledForInternet", {"SetEnabledForInternet"}),
                                ("GetTotalBytesSent", set())]:
            with self.assertRaises(ValueError):
                probe.read_action({}, action, actions)

    def test_byte_counters_are_exact_and_invalid_values_fail(self):
        self.assertEqual(probe.counter("18446744073709551615"), 18446744073709551615)
        for value in [None, "", "-1", "1.5", "NaN", "18446744073709551616", "１２"]:
            with self.assertRaises(ValueError):
                probe.counter(value)


if __name__ == "__main__":
    unittest.main()
