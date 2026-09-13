# BottleNet

Static prototype using HTML, CSS, vanilla JavaScript, and Tailwind CDN. No build step.

## Structure

```text
index.html                 Kiosk home screen and deposit flow
mockups/index.html         Laptop + phone presentation board
admin/index.html           PIN entry and admin workspace
assets/css/styles.css      Shared responsive visual system
assets/js/store.js         Shared persistent mock data + API base helpers
assets/js/device.js        SoftAP live poller (/api/status)
assets/js/portal.js        Deposit and connection states
assets/js/kiosk.js         Wi-Fi rates, help, and report sheets
assets/css/kiosk.css       Kiosk home screen styles
assets/css/security.css    Security and alarm styles
assets/js/admin.js         PIN flow, dashboard, and management
```

Open `index.html` in a browser. For consistent shared storage between pages, serve the folder on a local HTTP origin (for example `npx --yes serve .`). Tailwind and Lucide icons require internet; the custom stylesheet supplies the complete base layout and system fonts work offline.

Admin demo PIN: **1234**. Four digit fields support paste, numeric input, and keyboard navigation.

The portal's Preview controls switch station states and reset sample data. Choose Bottle accepted or Bottle rejected in the Station state dropdown to simulate hardware validation. These outcomes appear only in the preview controls; the normal deposit flow displays feedback without acceptance/rejection buttons. Mock sessions count down; deposits update admin transactions and station totals. Admin supports filtering, CSV export, session termination, maintenance, bin collection, and reward settings.

This is a UI prototype: client-side PIN checking is not authentication, and the timer does not authorize network access. Production requires backend authentication, validated hardware events, device/session association, and router enforcement. Browser storage provides demo persistence only; separate devices do not share it.

## SoftAP live device mode

When your phone or laptop is connected to the station SoftAP **PlasticBottle_WiFi**, the UI can poll the ESP firmware instead of (only) using mock data.

| Item | Value |
|------|--------|
| SoftAP SSID | PlasticBottle_WiFi |
| Device IP | 192.168.4.1 |
| Default API base | http://192.168.4.1 |
| Status endpoint | GET /api/status |
| Health endpoint | GET /api/health |
| CORS | * |

### How to open the UI on SoftAP

1. Connect the phone/laptop to **PlasticBottle_WiFi**.
2. Serve or open the BottleNet UI (see notes below) so scripts can call http://192.168.4.1.
3. Leave the API base at the default, or override it (next section).
4. When GET {base}/api/status is reachable, the UI switches to **Live** and updates timer, bin/trash, last bottle/weight/result, rates, and station labels from the device about once per second.
5. When the device is unreachable, the UI stays in (or falls back to) **Demo** with the existing mock Preview controls.

**Serving tip:** Prefer HTTP (not file://). Opening via file:// can hit browser CORS / mixed-content quirks even though the firmware sends Access-Control-Allow-Origin: *. Practical options:

- Copy the UI onto the phone and serve it with a simple local HTTP server, or
- Open the UI from any host that is also on PlasticBottle_WiFi, pointed at the device IP for API calls.

The UI does **not** require the firmware to be online to load; offline Demo mode works as before.

### Live vs Demo

- **Demo** (default / offline): sample station data, Preview controls work, badge says **Demo**.
- **Live** (SoftAP reachable): badge says **Live**; portal timer/bin/last-bottle fields track the device; admin workspace/footer/machine diagnostics show Live labels; Preview is labeled **Demo only** and mutations are disabled so they do not fight the device. Reset sample data stays Demo-only.

Demo state is snapshotted when entering Live and restored if the device becomes unreachable again.

### Override API base

Default: http://192.168.4.1

- Query param: ?api=http://192.168.4.1 (or another reachable base)
- Or localStorage key bottlenet-api-base
- Helpers: BottleNet.getApiBase() / BottleNet.setApiBase(url)

Priority: ?api= then localStorage then default.

## Wi-Fi rates

Time awarded depends on bottle size: 1L bottle **10 minutes**, Mismo size **7 minutes**, Sakto size **5 minutes**. Sizes are detected from weight (1L 24-45 g, Mismo 17-24 g, Sakto 10-17 g) and the minutes per size are editable in admin Settings. In Live mode, minutes follow firmware rates.coke1l / mismo / sakto.

## Security and alarms

The admin workspace has a **Security** tab showing the alarm history: bin opened, bottles removed from the bin, tamper, service door left open, and power interruption, each with severity, open/acknowledged status, and per-row or bulk acknowledgement. Unacknowledged alarms raise a banner across every admin tab and a count on the Security nav item.

All of this is mock data in browser storage. Real detection needs hardware sensors, a server-side alerting pipeline, and authenticated admin accounts.

## Mockups

`mockups/index.html` is a live presentation board: the admin dashboard inside a laptop frame and the connection portal inside a phone frame, both real iframes of the app rather than screenshots. Serve the folder over HTTP (for example `npx --yes serve .`) so both frames share demo storage. The laptop frame loads admin with `?unlock=1`, which skips the demo PIN for presentation only.

`mockups/bottlenet-devices.png` is the exported poster: the BottleNet logo on top with the admin dashboard on a laptop and the connection portal on a phone (3200 x 2000 px, 2x). Regenerate it from the live UI with `node tools/capture-poster.cjs` — it serves the folder, screenshots `mockups/poster.html` with an installed Chrome or Edge, and shuts the server down.

`mobile-mockups/index.html` remains the older screenshot board of three phone screens.
