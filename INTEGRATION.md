# BottleNet live integration

## Pieces
- **Firmware:** `/workspace/bottlenet-firmware/bottlenet_code.ino` — SoftAP `PlasticBottle_WiFi`, JSON at `http://192.168.4.1/api/status`
- **UI:** this folder — polls the ESP when reachable; otherwise stays in **Demo** with mock data

## How to run live
1. Flash `bottlenet_code.ino` to the ESP8266 (Arduino IDE / PlatformIO with HX711, Servo, ESP8266WiFi, ESP8266WebServer).
2. Phone/laptop joins Wi‑Fi **PlasticBottle_WiFi** (password on the board sticker / `FIRMWARE_API.md`).
3. On a machine that can open a local HTTP server for this folder (same phone or a laptop also on that SoftAP), run from this folder:
   `npx --yes serve .`
4. Open the portal URL shown by `serve`. Badge shows **Live** when `/api/status` responds; **Demo** when the ESP is offline.

## API
See `/workspace/bottlenet-firmware/FIRMWARE_API.md`.

## Notes
- Preview controls are demo-only while Live.
- Admin PIN `1234` is still demo auth — not production security.
- SoftAP password is for the machine AP, not a user account.
