# Free YouTube mapping audit

Primary study source: Jeremy's IT Lab **free** CCNA 200-301 YouTube course. Every row below was matched to the official playlist (126 videos) and verified individually with YouTube oEmbed (channel = Jeremy's IT Lab, title identical). Durations are the playlist durations. Snapshot: `seed/source/youtube-playlist-2026-10-07.json`. Re-checked by `npm test` (`scripts/curriculum.test.ts`).

Matching rule: each seed day is matched to the playlist videos carrying the same `Day N` label; lectures in playlist order, labs by `Day N Lab` (and `Lab 1/2` for Day 11). Day counts matched exactly (74 lectures + 52 labs = 126 videos, none unused).

Stable ids are unchanged (`seed/source/stable-ids-pre-youtube-migration.json`). Where the Academy title differs from the YouTube title, the YouTube title is shown to the user and the Academy title is kept as `academyTitle`.

| Day | Item id | Type | Free YouTube title | Video | Length | Academy title (optional) | Status |
|---|---|---|---|---|---|---|---|
| 1 | `day-01-lec-1` | lecture | Network Devices | [H8W9oMNSuwo](https://www.youtube.com/watch?v=H8W9oMNSuwo) | 30:26 |  | verified |
| 1 | `day-01-lec-2` | extra | Anki Flashcards | [6Atw8oMtVTA](https://www.youtube.com/watch?v=6Atw8oMtVTA) | 14:56 |  | verified |
| 1 | `day-01-lab-1` | lab | Packet Tracer Introduction | [a1Im6GYaSno](https://www.youtube.com/watch?v=a1Im6GYaSno) | 15:18 | Intro to Packet Tracer | verified |
| 2 | `day-02-lec-1` | lecture | Interfaces and Cables | [ieTH5lVhNaY](https://www.youtube.com/watch?v=ieTH5lVhNaY) | 35:52 |  | verified |
| 2 | `day-02-lab-1` | lab | Connecting Devices | [K6Qt23sY68Y](https://www.youtube.com/watch?v=K6Qt23sY68Y) | 5:33 |  | verified |
| 3 | `day-03-lec-1` | lecture | How the TCP/IP Model Actually Works | [yM-XNq9ADlI](https://www.youtube.com/watch?v=yM-XNq9ADlI) | 42:42 | The TCP/IP Model | verified |
| 3 | `day-03-lab-1` | lab | OSI Model | [7nmYoL0t2tU](https://www.youtube.com/watch?v=7nmYoL0t2tU) | 8:05 |  | verified |
| 4 | `day-04-lec-1` | lecture | Intro to the CLI | [IYbtai7Nu2g](https://www.youtube.com/watch?v=IYbtai7Nu2g) | 31:06 |  | verified |
| 4 | `day-04-lab-1` | lab | Basic Device Security | [SDocmq1c05s](https://www.youtube.com/watch?v=SDocmq1c05s) | 10:26 |  | verified |
| 5 | `day-05-lec-1` | lecture | Ethernet LAN Switching (Part 1) | [u2n762WG0Vo](https://www.youtube.com/watch?v=u2n762WG0Vo) | 38:13 |  | verified |
| 6 | `day-06-lec-1` | lecture | Ethernet LAN Switching (Part 2) | [5q1pqdmdPjo](https://www.youtube.com/watch?v=5q1pqdmdPjo) | 33:41 |  | verified |
| 6 | `day-06-lab-1` | lab | Analyzing Ethernet Switching | [Ig0dSaOQDI8](https://www.youtube.com/watch?v=Ig0dSaOQDI8) | 10:29 | Ethernet LAN Switching | verified |
| 7 | `day-07-lec-1` | lecture | IPv4 Addressing (Part 1) | [3ROdsfEUuhs](https://www.youtube.com/watch?v=3ROdsfEUuhs) | 40:21 |  | verified |
| 8 | `day-08-lec-1` | lecture | IPv4 Addressing (Part 2) | [FiAatRd84XI](https://www.youtube.com/watch?v=FiAatRd84XI) | 30:42 |  | verified |
| 8 | `day-08-lab-1` | lab | Configuring IP Addresses | [e1jbvyMeS5I](https://www.youtube.com/watch?v=e1jbvyMeS5I) | 10:06 | Configuring IPv4 Addresses | verified |
| 9 | `day-09-lec-1` | lecture | Switch Interfaces | [cCqluocfQe0](https://www.youtube.com/watch?v=cCqluocfQe0) | 32:28 |  | verified |
| 9 | `day-09-lab-1` | lab | Configuring Interfaces | [rzDb5DoBKRk](https://www.youtube.com/watch?v=rzDb5DoBKRk) | 11:54 | Configuring Switch Interfaces | verified |
| 10 | `day-10-lec-1` | lecture | IPv4 Header | [aQB22y4liXA](https://www.youtube.com/watch?v=aQB22y4liXA) | 30:11 | The IPv4 Header | verified |
| 11 | `day-11-lec-1` | lecture | Routing Fundamentals | [aHwAm8GYbn8](https://www.youtube.com/watch?v=aHwAm8GYbn8) | 31:00 |  | verified |
| 11 | `day-11-lec-2` | lecture | Static Routing | [YCv4-_sMvYE](https://www.youtube.com/watch?v=YCv4-_sMvYE) | 37:44 |  | verified |
| 11 | `day-11-lab-1` | lab | Configuring Static Routes | [XHxOtIav2k8](https://www.youtube.com/watch?v=XHxOtIav2k8) | 12:29 |  | verified |
| 11 | `day-11-lab-2` | lab | Troubleshooting Static Routes | [3z8YGEVFTiA](https://www.youtube.com/watch?v=3z8YGEVFTiA) | 9:45 |  | verified |
| 12 | `day-12-lec-1` | lecture | The Life of a Packet | [4YrYV2io3as](https://www.youtube.com/watch?v=4YrYV2io3as) | 20:13 | Life of a Packet | verified |
| 12 | `day-12-lab-1` | lab | Life of a Packet | [bfsEqDeHbpI](https://www.youtube.com/watch?v=bfsEqDeHbpI) | 15:36 |  | verified |
| 13 | `day-13-lec-1` | lecture | Subnetting (Part 1) | [bQ8sdpGQu8c](https://www.youtube.com/watch?v=bQ8sdpGQu8c) | 28:54 |  | verified |
| 14 | `day-14-lec-1` | lecture | Subnetting (Part 2) | [IGhd-0di0Qo](https://www.youtube.com/watch?v=IGhd-0di0Qo) | 24:47 |  | verified |
| 15 | `day-15-lec-1` | lecture | Subnetting (Part 3 - VLSM) | [z-JqCedc9EI](https://www.youtube.com/watch?v=z-JqCedc9EI) | 23:53 | Subnetting (Part 3) | verified |
| 15 | `day-15-lab-1` | lab | Subnetting (VLSM) | [Rn_E1Qv8--I](https://www.youtube.com/watch?v=Rn_E1Qv8--I) | 14:59 | VLSM | verified |
| 16 | `day-16-lec-1` | lecture | VLANs (Part 1) | [cjFzOnm6u1g](https://www.youtube.com/watch?v=cjFzOnm6u1g) | 23:45 |  | verified |
| 16 | `day-16-lab-1` | lab | VLANs (Part 1) | [-tq7f3xtyLQ](https://www.youtube.com/watch?v=-tq7f3xtyLQ) | 11:02 |  | verified |
| 17 | `day-17-lec-1` | lecture | VLANs (Part 2) | [Jl9OOzNaBDU](https://www.youtube.com/watch?v=Jl9OOzNaBDU) | 40:01 |  | verified |
| 17 | `day-17-lab-1` | lab | VLANs (Part 2) | [iRkFE_lpYgc](https://www.youtube.com/watch?v=iRkFE_lpYgc) | 23:23 |  | verified |
| 18 | `day-18-lec-1` | lecture | VLANs (Part 3) | [OkPB028l2eE](https://www.youtube.com/watch?v=OkPB028l2eE) | 32:32 |  | verified |
| 18 | `day-18-lab-1` | lab | VLANs (Part 3) | [MQcCr3QW1vE](https://www.youtube.com/watch?v=MQcCr3QW1vE) | 25:19 | Multilayer Switching | **needs_review** |
| 19 | `day-19-lec-1` | lecture | DTP/VTP | [JtQV_0Sjszg](https://www.youtube.com/watch?v=JtQV_0Sjszg) | 37:34 |  | verified |
| 19 | `day-19-lab-1` | lab | DTP/VTP | [ngTns2vF_44](https://www.youtube.com/watch?v=ngTns2vF_44) | 18:47 |  | verified |
| 20 | `day-20-lec-1` | lecture | Spanning Tree Protocol (Part 1) | [j-bK-EFt9cY](https://www.youtube.com/watch?v=j-bK-EFt9cY) | 38:39 | STP (Part 1) | verified |
| 20 | `day-20-lab-1` | lab | Analyzing STP | [Ev9gy7B5hx0](https://www.youtube.com/watch?v=Ev9gy7B5hx0) | 18:55 |  | verified |
| 21 | `day-21-lec-1` | lecture | Spanning Tree Protocol (Part 2) | [nWpldCc8msY](https://www.youtube.com/watch?v=nWpldCc8msY) | 42:18 | STP (Part 2) | verified |
| 21 | `day-21-lec-2` | lecture | PortFast (STP Toolkit) | [zqzppl4LOwk](https://www.youtube.com/watch?v=zqzppl4LOwk) | 17:34 | PortFast | verified |
| 21 | `day-21-lec-3` | lecture | BPDU Guard & BPDU Filter (STP Toolkit) | [jfC_AeJnuhY](https://www.youtube.com/watch?v=jfC_AeJnuhY) | 24:24 | BPDU Guard & BPDU Filter | verified |
| 21 | `day-21-lec-4` | lecture | Root Guard (STP Toolkit) | [2XE_PgkvSic](https://www.youtube.com/watch?v=2XE_PgkvSic) | 19:44 | Root Guard | verified |
| 21 | `day-21-lec-5` | lecture | Loop Guard (STP Toolkit) | [uJ5_Klha0ig](https://www.youtube.com/watch?v=uJ5_Klha0ig) | 18:49 | Loop Guard | verified |
| 21 | `day-21-lab-1` | lab | Configuring STP (PVST+) | [5rpaeJNig2o](https://www.youtube.com/watch?v=5rpaeJNig2o) | 17:09 | Configuring STP | verified |
| 22 | `day-22-lec-1` | lecture | Rapid Spanning Tree Protocol | [EpazNsLlPps](https://www.youtube.com/watch?v=EpazNsLlPps) | 43:01 | Rapid STP | verified |
| 22 | `day-22-lab-1` | lab | Rapid STP | [YG7r4XHy2JU](https://www.youtube.com/watch?v=YG7r4XHy2JU) | 19:50 |  | verified |
| 23 | `day-23-lec-1` | lecture | EtherChannel | [xuo69Joy_Nc](https://www.youtube.com/watch?v=xuo69Joy_Nc) | 41:33 |  | verified |
| 23 | `day-23-lab-1` | lab | Configuring EtherChannel | [8gKF2fMMjA8](https://www.youtube.com/watch?v=8gKF2fMMjA8) | 25:03 | EtherChannel | verified |
| 24 | `day-24-lec-1` | lecture | Dynamic Routing | [xSTgb8JLkvs](https://www.youtube.com/watch?v=xSTgb8JLkvs) | 44:38 |  | verified |
| 24 | `day-24-lab-1` | lab | Floating Static Routes | [KuKC0G3LZc8](https://www.youtube.com/watch?v=KuKC0G3LZc8) | 23:20 |  | verified |
| 25 | `day-25-lec-1` | lecture | RIP & EIGRP | [N8PiZDld6Zc](https://www.youtube.com/watch?v=N8PiZDld6Zc) | 43:42 |  | verified |
| 25 | `day-25-lab-1` | lab | Configuring EIGRP | [ffnJ5oBIObY](https://www.youtube.com/watch?v=ffnJ5oBIObY) | 26:14 |  | verified |
| 26 | `day-26-lec-1` | lecture | OSPF Part 1 | [pvuaoJ9YzoI](https://www.youtube.com/watch?v=pvuaoJ9YzoI) | 39:40 | OSPF (Part 1) | verified |
| 26 | `day-26-lab-1` | lab | Configuring OSPF (1) | [LeLRWjfylcs](https://www.youtube.com/watch?v=LeLRWjfylcs) | 22:07 | Configuring OSPF (Part 1) | verified |
| 27 | `day-27-lec-1` | lecture | OSPF Part 2 | [VtzfTA21ht0](https://www.youtube.com/watch?v=VtzfTA21ht0) | 36:55 | OSPF (Part 2) | verified |
| 27 | `day-27-lab-1` | lab | Configuring OSPF (2) | [UEyQW-EcnY8](https://www.youtube.com/watch?v=UEyQW-EcnY8) | 22:10 | Configuring OSPF (Part 2) | verified |
| 28 | `day-28-lec-1` | lecture | OSPF Part 3 | [3ew26ujkiDI](https://www.youtube.com/watch?v=3ew26ujkiDI) | 47:53 | OSPF (Part 3) | verified |
| 28 | `day-28-lab-1` | lab | Configuring OSPF (3) | [Goekjm3bK5o](https://www.youtube.com/watch?v=Goekjm3bK5o) | 21:25 | Configuring OSPF (Part 3) | verified |
| 29 | `day-29-lec-1` | lecture | First Hop Redundancy Protocols | [43WnpwQMolo](https://www.youtube.com/watch?v=43WnpwQMolo) | 40:25 |  | verified |
| 29 | `day-29-lab-1` | lab | Configuring HSRP | [uho5Z2nFhb8](https://www.youtube.com/watch?v=uho5Z2nFhb8) | 22:01 |  | verified |
| 30 | `day-30-lec-1` | lecture | TCP & UDP | [LIEACBqlntY](https://www.youtube.com/watch?v=LIEACBqlntY) | 33:59 |  | verified |
| 30 | `day-30-lab-1` | lab | Wireshark Demo (TCP/UDP) | [pJKFahkqMU8](https://www.youtube.com/watch?v=pJKFahkqMU8) | 11:15 | Wireshark Demo | verified |
| 31 | `day-31-lec-1` | lecture | IPv6 Part 1 | [ZNuXyOXae5U](https://www.youtube.com/watch?v=ZNuXyOXae5U) | 39:26 | IPv6 (Part 1) | verified |
| 31 | `day-31-lab-1` | lab | Configuring IPv6 (Part 1) | [BdsIahtrWIA](https://www.youtube.com/watch?v=BdsIahtrWIA) | 18:02 |  | verified |
| 32 | `day-32-lec-1` | lecture | IPv6 Part 2 | [BrTMMOXFhDU](https://www.youtube.com/watch?v=BrTMMOXFhDU) | 39:33 | IPv6 (Part 2) | verified |
| 32 | `day-32-lab-1` | lab | Configuring IPv6 (Part 2) | [Zfhpd7dl6QI](https://www.youtube.com/watch?v=Zfhpd7dl6QI) | 21:02 |  | verified |
| 33 | `day-33-lec-1` | lecture | IPv6 Part 3 | [rwkHfsWQwy8](https://www.youtube.com/watch?v=rwkHfsWQwy8) | 43:51 | IPv6 (Part 3) | verified |
| 33 | `day-33-lab-1` | lab | Configuring IPv6 (Part 3) | [WSBEVFANMmc](https://www.youtube.com/watch?v=WSBEVFANMmc) | 19:17 |  | verified |
| 34 | `day-34-lec-1` | lecture | Standard ACLs | [z023_eRUtSo](https://www.youtube.com/watch?v=z023_eRUtSo) | 46:51 |  | verified |
| 34 | `day-34-lab-1` | lab | Standard ACLs | [sJ8PXmiAkvs](https://www.youtube.com/watch?v=sJ8PXmiAkvs) | 27:01 |  | verified |
| 35 | `day-35-lec-1` | lecture | Extended ACLs | [dUttKY_CNXE](https://www.youtube.com/watch?v=dUttKY_CNXE) | 40:55 |  | verified |
| 35 | `day-35-lab-1` | lab | Extended ACLs | [1cuMzWBrEYs](https://www.youtube.com/watch?v=1cuMzWBrEYs) | 22:08 |  | verified |
| 36 | `day-36-lec-1` | lecture | CDP & LLDP | [_hnMZBzXRRk](https://www.youtube.com/watch?v=_hnMZBzXRRk) | 39:23 |  | verified |
| 36 | `day-36-lab-1` | lab | CDP & LLDP | [4s8qqL7R9W8](https://www.youtube.com/watch?v=4s8qqL7R9W8) | 24:37 |  | verified |
| 37 | `day-37-lec-1` | lecture | NTP | [qGJaJx7OfUo](https://www.youtube.com/watch?v=qGJaJx7OfUo) | 42:46 |  | verified |
| 37 | `day-37-lab-1` | lab | NTP | [Miys7Ft9wWI](https://www.youtube.com/watch?v=Miys7Ft9wWI) | 19:08 |  | verified |
| 38 | `day-38-lec-1` | lecture | DNS | [4C6eeQes4cs](https://www.youtube.com/watch?v=4C6eeQes4cs) | 30:11 |  | verified |
| 38 | `day-38-lab-1` | lab | DNS | [7D_FapNrRUM](https://www.youtube.com/watch?v=7D_FapNrRUM) | 17:31 |  | verified |
| 39 | `day-39-lec-1` | lecture | DHCP | [hzkleGAC2_Y](https://www.youtube.com/watch?v=hzkleGAC2_Y) | 37:02 |  | verified |
| 39 | `day-39-lab-1` | lab | DHCP | [cgMsoIQB9Wk](https://www.youtube.com/watch?v=cgMsoIQB9Wk) | 17:49 |  | verified |
| 40 | `day-40-lec-1` | lecture | SNMP | [HXu0Ifj0oWU](https://www.youtube.com/watch?v=HXu0Ifj0oWU) | 29:21 |  | verified |
| 40 | `day-40-lab-1` | lab | SNMP | [v8WxIytUdS4](https://www.youtube.com/watch?v=v8WxIytUdS4) | 13:37 |  | verified |
| 41 | `day-41-lec-1` | lecture | Syslog | [RaQPSKQ4J5A](https://www.youtube.com/watch?v=RaQPSKQ4J5A) | 27:58 |  | verified |
| 41 | `day-41-lab-1` | lab | Syslog | [-R_CYM6Wm-Y](https://www.youtube.com/watch?v=-R_CYM6Wm-Y) | 14:03 |  | verified |
| 42 | `day-42-lec-1` | lecture | SSH | [AvgYqI2qSD4](https://www.youtube.com/watch?v=AvgYqI2qSD4) | 31:07 |  | verified |
| 42 | `day-42-lab-1` | lab | SSH | [QnHq7iCOtTc](https://www.youtube.com/watch?v=QnHq7iCOtTc) | 15:50 |  | verified |
| 43 | `day-43-lec-1` | lecture | FTP & TFTP | [50hcfsoBf4Q](https://www.youtube.com/watch?v=50hcfsoBf4Q) | 30:55 |  | verified |
| 43 | `day-43-lab-1` | lab | FTP & TFTP | [W9PLvA2wZ28](https://www.youtube.com/watch?v=W9PLvA2wZ28) | 15:36 |  | verified |
| 44 | `day-44-lec-1` | lecture | NAT (Part 1) | [2TZCfTgopeg](https://www.youtube.com/watch?v=2TZCfTgopeg) | 32:10 |  | verified |
| 44 | `day-44-lab-1` | lab | Static NAT | [vir6n_NVZFw](https://www.youtube.com/watch?v=vir6n_NVZFw) | 14:12 |  | verified |
| 45 | `day-45-lec-1` | lecture | NAT (part 2) | [kILDNs4KjYE](https://www.youtube.com/watch?v=kILDNs4KjYE) | 29:40 | NAT (Part 2) | verified |
| 45 | `day-45-lab-1` | lab | Dynamic NAT | [vNs1xxiwGJs](https://www.youtube.com/watch?v=vNs1xxiwGJs) | 15:01 |  | verified |
| 46 | `day-46-lec-1` | lecture | QoS (Part 1) | [H6FKJMiiL6E](https://www.youtube.com/watch?v=H6FKJMiiL6E) | 32:33 |  | verified |
| 46 | `day-46-lab-1` | lab | Voice VLANs | [kGX76QNIjsE](https://www.youtube.com/watch?v=kGX76QNIjsE) | 20:18 |  | verified |
| 47 | `day-47-lec-1` | lecture | QoS (Part 2) | [4vurfhVjcMM](https://www.youtube.com/watch?v=4vurfhVjcMM) | 41:46 |  | verified |
| 47 | `day-47-lab-1` | lab | QoS | [63tD4t8189k](https://www.youtube.com/watch?v=63tD4t8189k) | 15:41 |  | verified |
| 48 | `day-48-lec-1` | lecture | Security Fundamentals | [VvFuieyTTSw](https://www.youtube.com/watch?v=VvFuieyTTSw) | 38:40 |  | verified |
| 48 | `day-48-lab-1` | lab | Kali Linux Demo | [EBs47-0ZD-A](https://www.youtube.com/watch?v=EBs47-0ZD-A) | 10:25 |  | verified |
| 49 | `day-49-lec-1` | lecture | Port Security | [sHN3jOJIido](https://www.youtube.com/watch?v=sHN3jOJIido) | 34:28 |  | verified |
| 49 | `day-49-lab-1` | lab | Port Security | [zZwhrxKeGj8](https://www.youtube.com/watch?v=zZwhrxKeGj8) | 17:03 |  | verified |
| 50 | `day-50-lec-1` | lecture | DHCP Snooping | [qYYeg2kz1yE](https://www.youtube.com/watch?v=qYYeg2kz1yE) | 28:23 |  | verified |
| 50 | `day-50-lab-1` | lab | DHCP Snooping | [YMom_e545H4](https://www.youtube.com/watch?v=YMom_e545H4) | 15:41 |  | verified |
| 51 | `day-51-lec-1` | lecture | Dynamic ARP Inspection | [HwbTKaIvL6s](https://www.youtube.com/watch?v=HwbTKaIvL6s) | 32:50 |  | verified |
| 51 | `day-51-lab-1` | lab | Dynamic ARP Inspection | [oLF2mbmYMAk](https://www.youtube.com/watch?v=oLF2mbmYMAk) | 20:53 |  | verified |
| 52 | `day-52-lec-1` | lecture | LAN Architectures | [PvyEcLhmNBk](https://www.youtube.com/watch?v=PvyEcLhmNBk) | 28:06 |  | verified |
| 52 | `day-52-lab-1` | lab | STP & FHRP Synchronization | [BgIEhyoETgU](https://www.youtube.com/watch?v=BgIEhyoETgU) | 19:11 |  | verified |
| 53 | `day-53-lec-1` | lecture | WAN Architectures | [BW3fQgdf4-w](https://www.youtube.com/watch?v=BW3fQgdf4-w) | 37:34 |  | verified |
| 53 | `day-53-lab-1` | lab | GRE Tunnels | [_MMuU5viinM](https://www.youtube.com/watch?v=_MMuU5viinM) | 22:04 |  | verified |
| 54 | `day-54-lec-1` | lecture | Virtualization & Cloud | [_S3greGajJA](https://www.youtube.com/watch?v=_S3greGajJA) | 38:41 |  | verified |
| 54 | `day-54-lec-2` | lecture | Containers | [K731pAS22Aw](https://www.youtube.com/watch?v=K731pAS22Aw) | 13:33 |  | verified |
| 54 | `day-54-lec-3` | lecture | VRF | [Ge4644KUvh4](https://www.youtube.com/watch?v=Ge4644KUvh4) | 18:03 |  | verified |
| 54 | `day-54-lab-1` | lab | Oracle VirtualBox | [swqADfQk2jM](https://www.youtube.com/watch?v=swqADfQk2jM) | 8:43 |  | verified |
| 55 | `day-55-lec-1` | lecture | Wireless Fundamentals | [zuYiktLqNYQ](https://www.youtube.com/watch?v=zuYiktLqNYQ) | 35:57 |  | verified |
| 56 | `day-56-lec-1` | lecture | Wireless Architectures | [uX1h0F6wpBY](https://www.youtube.com/watch?v=uX1h0F6wpBY) | 38:21 |  | verified |
| 57 | `day-57-lec-1` | lecture | Wireless Security | [wHXKo9So5y8](https://www.youtube.com/watch?v=wHXKo9So5y8) | 33:53 |  | verified |
| 58 | `day-58-lec-1` | lecture | Wireless Configuration | [r9o6GFI87go](https://www.youtube.com/watch?v=r9o6GFI87go) | 46:38 |  | verified |
| 58 | `day-58-lab-1` | lab | Wireless LANs | [Il8ev78fcqw](https://www.youtube.com/watch?v=Il8ev78fcqw) | 17:28 |  | verified |
| 59 | `day-59-lec-1` | lecture | Intro to Network Automation | [4tsBgMCPVuc](https://www.youtube.com/watch?v=4tsBgMCPVuc) | 33:27 |  | verified |
| 59 | `day-59-lec-2` | lecture | AI & Machine Learning | [Fn_kAv35W5A](https://www.youtube.com/watch?v=Fn_kAv35W5A) | 41:49 |  | verified |
| 60 | `day-60-lec-1` | lecture | JSON, XML, & YAML | [nohde2-QNJ4](https://www.youtube.com/watch?v=nohde2-QNJ4) | 28:56 |  | verified |
| 61 | `day-61-lec-1` | lecture | REST APIs | [Luei0p-2h10](https://www.youtube.com/watch?v=Luei0p-2h10) | 31:45 |  | verified |
| 61 | `day-61-lec-2` | lecture | REST API Authentication | [bmqr_xpt6sc](https://www.youtube.com/watch?v=bmqr_xpt6sc) | 29:15 |  | verified |
| 62 | `day-62-lec-1` | lecture | Software-Defined Networking | [7HhWCeXDTpA](https://www.youtube.com/watch?v=7HhWCeXDTpA) | 28:19 | SDN | verified |
| 63 | `day-63-lec-1` | lecture | Ansible, Puppet, & Chef | [Kog9gHTjALI](https://www.youtube.com/watch?v=Kog9gHTjALI) | 21:33 | Ansible, Puppet, Chef | verified |
| 63 | `day-63-lec-2` | lecture | Terraform | [VAwUaffejWU](https://www.youtube.com/watch?v=VAwUaffejWU) | 22:29 |  | verified |
| Mega | `mega-lab` | lab | CCNA Mega Lab | [2p7-MluKAgE](https://www.youtube.com/watch?v=2p7-MluKAgE) | 2:38:50 |  | verified |

## Needs review

- `day-18-lab-1`: the free video `Free CCNA | VLANs (Part 3) | Day 18 Lab` is the only Day 18 lab video, so it is the lab to use. The paid Academy calls this lab "Multilayer Switching" and its clip is a different length. Confirm they cover the same lab. The blueprint mapping on this lab (2.1.c) was already `needs_review`.

## Free resources (course level)

| Resource | URL | Access |
|---|---|---|
| Jeremy's IT Lab CCNA 200-301 (free YouTube course) | https://www.youtube.com/playlist?list=PLxbwE86jKRgMpuZuLBivzlM8s2Dk5lXBQ | free |
| Free flashcards and Packet Tracer practice labs | https://jitl.jp/ccna-files | free |
| CCNA Mega Lab file | https://jitl.jp/mega-lab | free |
| Download Cisco Packet Tracer | https://jitl.jp/packet-tracer | free |
| Anki (flashcard software) | https://apps.ankiweb.net/ | free |
| Jeremy's recommended CCNA resources | https://www.jeremysitlab.com/ccna-resources/ | free |
| JITL Academy (ad-free course with bonus quizzes) | https://courses.jeremysitlab.com | paid_optional |

Lab files and flashcards are delivered by Jeremy's free email signup (`jitl.jp/ccna-files` redirects to `sendfox.com/jeremysitlab`), so individual `.pkt` files have no stable per-lab URL. They are recorded as `labFilesVerification: course_level`. The Mega Lab file is a public Google Drive folder.
