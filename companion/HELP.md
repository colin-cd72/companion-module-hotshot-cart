# HotShot Cart

Control HotShot Cart professional audio cart player from Bitfocus Companion.

## Configuration

- **Target IP**: IP address of the computer running HotShot Cart (default: `localhost`)
- **Target Port**: HTTP API port configured in HotShot Cart (default: `8080`)
- **Buttons Per Page**: Must match the grid size in HotShot Cart, rows x columns (default: `24`)
- **Pages**: Number of pages in HotShot Cart. Variables are created for Pages x Buttons Per Page buttons (default: `10`)
- **Status API Token** / **Control API Token**: Only needed when "Require API Token" is enabled in HotShot Cart. Status token is used for polling, control token for actions. If only one is set it is used for both.
- **Use live WebSocket (0.2.0+)**: Receive status pushed by HotShot Cart over its `/api/ws` WebSocket instead of polling (default: enabled). Needs HotShot Cart 0.2.0 or later with Remote turned on; otherwise the module polls as before
- **Pairing code**: The code shown in HotShot Cart under Settings > Control > Remote. The module pairs once, stores the device token and clears the field. Not needed when a Control API Token is set and "Require API Token" is on in HotShot Cart
- **Enable Polling**: Poll `GET /api/status` for status updates (default: enabled). Used while the live feed is off or unavailable
- **Poll Interval**: How often to check status in milliseconds (default: `1000`)

## Live feed (HotShot Cart 0.2.0+)

With the live WebSocket on, HotShot Cart pushes playback state, labels and chain state as they change, so feedbacks and variables update immediately and the module no longer requests the status every second. The values are the same as with polling.

The socket needs either the **Control API Token** (accepted while "Require API Token" is on in HotShot Cart) or a device token from pairing: turn on Remote in HotShot Cart, enter the **Pairing code**, save. The log shows `Paired with ...` and then `Live feed connected`. Polling is paused while the socket is open and resumes the moment it closes; the module reconnects with a 1 to 10 second backoff. An older HotShot Cart (no `/api/ws`) is detected and simply polled.

## Actions

| Action            | Description                                           |
| ----------------- | ----------------------------------------------------- |
| **Play Button**   | Start playback of a cart button (1-999)               |
| **Stop Button**   | Stop playback of a cart button                        |
| **Toggle Button** | Play if idle, fade out if playing                     |
| **Fade Button**   | Fade out with custom duration (0.1-30 seconds)        |
| **Flow: GO**      | Advance the running chain, like Space (0.1.11+)       |
| **Flow: Hold**    | Hold or resume the chain's playing button (0.1.11+)   |
| **Stop All**      | Stop every playing button and end the chain (0.1.11+) |

A button with **Solo Mode** enabled in HotShot Cart stops the other playing buttons when it starts, except the buttons it triggers. This applies to Play and Toggle from Companion with HotShot Cart 0.1.8 or later.

## Feedbacks

| Feedback                 | Description                                      |
| ------------------------ | ------------------------------------------------ |
| **Button Playing State** | Shows green when the specified button is playing |
| **Chain Running**        | Lit while a chain (Flow) is running              |

## Variables

### Chain (Flow) Variables

- `$(hotshot-cart:flow_running)`, `flow_current`, `flow_next`, `flow_go`, `flow_paused`

### Global Variables

- `$(hotshot-cart:clip_name)` - Currently playing clip name
- `$(hotshot-cart:status)` - Player status (idle/playing)
- `$(hotshot-cart:timecode)` - Current timecode
- `$(hotshot-cart:remaining_timecode)` - Time remaining

### Button Variables (X = 1 to Pages x Buttons Per Page, 240 by default)

- `$(hotshot-cart:button_X_state)` - Playback state (idle/playing/paused/stopping/fading/error)
- `$(hotshot-cart:button_X_label)` - Button label
- `$(hotshot-cart:button_X_artist)` - Artist name
- `$(hotshot-cart:button_X_item_number)` - Item number
- `$(hotshot-cart:button_X_track_count)` - Number of tracks
- `$(hotshot-cart:button_X_time_remaining)` - Time remaining (MM:SS)
- `$(hotshot-cart:button_X_duration)` - Duration (MM:SS)

## Setup

1. Open HotShot Cart and note the HTTP port in Settings
2. Add this module in Companion
3. Configure the IP and port
4. For the live feed (HotShot Cart 0.2.0+): turn on Remote in HotShot Cart and enter the pairing code, or set the Control API Token if HotShot Cart requires API tokens
5. Create buttons using actions and feedbacks

## Troubleshooting

- **Connection Failed**: Verify HotShot Cart is running and the IP/port are correct
- **HTTP 401/403 in the log**: HotShot Cart requires API tokens; enter the matching tokens in the module configuration
- **Status Not Updating**: Enable polling in module configuration, or the live WebSocket with HotShot Cart 0.2.0+
- **Live feed not connecting**: The log says why. `no live feed` means HotShot Cart is older than 0.2.0 or Remote is off; `wrong pairing code` means re-read the code in HotShot Cart; `refused the Control API Token` means HotShot Cart does not require API tokens, so pair with the code instead; `no longer accepts the stored device token` means the device was forgotten in HotShot Cart, enter the code again
- **Buttons Not Responding**: Check that HTTP API is enabled in HotShot Cart settings
- **Wrong Button Lights Up**: Set Buttons Per Page to match the HotShot Cart grid size
