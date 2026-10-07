# Blueprint mapping review

Mappings: 156 (95 high, 61 needs_review). Blueprint: ccna-200-301-v1.1.

## How these were made
- Cisco objectives come from the official v1.1 exam-topics PDF (see seed/blueprints.json `reviewFlags`).
- No Jeremy-published objective mapping was found, so every mapping is **my analysis of official lesson titles against Cisco objective wording**. Nothing was invented from video content I have not watched.
- `high` = the lesson/lab title names the objective subject (e.g. "Static Routing" -> 3.3). `needs_review` = plausible from the topic but not stated by the title. Only `high` mappings count toward blueprint coverage; `needs_review` shows as tentative.
- Set `"reviewed": true` and change `confidence` in `seed/lesson-objective-mappings.json` as you confirm items while watching.

## Top-level objectives with no high-confidence content (coverage gaps)
- 1.4 Identify interface and cable issues (collisions, errors, mismatch duplex, and/or speed) (tentative mapping only)
- 1.7 Describe private IPv4 addressing (tentative mapping only)
- 1.9 Describe IPv6 address types (tentative mapping only)
- 1.10 Verify IP parameters for Client OS (Windows, Mac OS, Linux) (no mapping)
- 1.13 Describe switching concepts (tentative mapping only)
- 2.2 Configure and verify interswitch connectivity (tentative mapping only)
- 2.7 Describe physical infrastructure connections of WLAN components (AP, WLC, access/trunk ports, and LAG) (tentative mapping only)
- 2.8 Describe network device management access (Telnet, SSH, HTTP, HTTPS, console, TACACS+/RADIUS, and cloud managed) (tentative mapping only)
- 4.6 Configure and verify DHCP client and relay (tentative mapping only)
- 5.2 Describe security program elements (user awareness, training, and physical access control) (tentative mapping only)
- 5.3 Configure and verify device access control using local passwords (tentative mapping only)
- 5.4 Describe security password policy elements, such as management, complexity, and password alternatives (multifactor authentication, certificates, and biometrics) (tentative mapping only)
- 5.5 Describe IPsec remote access and site-to-site VPNs (tentative mapping only)
- 5.8 Compare authentication, authorization, and accounting concepts (no mapping)

## Jeremy items with no objective mapping (taught but not a v1.1 objective title match)
- Day 3 lecture: The TCP/IP Model
- Day 4 lecture: Intro to the CLI
- Day 10 lecture: The IPv4 Header
- Day 1 lab: Intro to Packet Tracer
- Day 3 lab: OSI Model
- Day 25 lab: Configuring EIGRP
- Day 53 lab: GRE Tunnels


## Note after the free-YouTube migration
Stable lecture and lab ids are unchanged, so no mapping needed updating. The only title difference that affects a mapped item is `ccna-jeremy-day-18-lab-1` (free video: "VLANs (Part 3)"; Academy title: "Multilayer Switching"); its mapping to 2.1.c was already `needs_review`.
