# HotShot Cart

Control HotShot Cart professional audio cart player from Bitfocus Companion.

## Configuration

- **Target IP**: IP address of the computer running HotShot Cart (default: `localhost`)
- **Target Port**: HTTP API port configured in HotShot Cart (default: `8080`)
- **Buttons Per Page**: Must match the grid size in HotShot Cart, rows x columns (default: `24`)
- **Pages**: Number of pages in HotShot Cart. Variables are created for Pages x Buttons Per Page buttons (default: `10`)
- **Status API Token** / **Control API Token**: Only needed when "Require API Token" is enabled in HotShot Cart. Status token is used for polling, control token for actions. If only one is set it is used for both.
- **Enable Polling**: Enable real-time status updates (default: enabled)
- **Poll Interval**: How often to check status in milliseconds (default: `1000`)

## Actions

| Action            | Description                                         |
| ----------------- | --------------------------------------------------- |
| **Play Button**   | Start playback of a cart button (1-999)             |
| **Stop Button**   | Stop playback of a cart button                      |
| **Toggle Button** | Play if idle, fade out if playing                   |
| **Fade Button**   | Fade out with custom duration (0.1-30 seconds)      |
| **Flow: GO**      | Advance the running chain, like Space (0.1.11+)     |
| **Flow: Hold**    | Hold or resume the chain's playing button (0.1.11+) |

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
4. Create buttons using actions and feedbacks

## Troubleshooting

- **Connection Failed**: Verify HotShot Cart is running and the IP/port are correct
- **HTTP 401/403 in the log**: HotShot Cart requires API tokens; enter the matching tokens in the module configuration
- **Status Not Updating**: Enable polling in module configuration
- **Buttons Not Responding**: Check that HTTP API is enabled in HotShot Cart settings
- **Wrong Button Lights Up**: Set Buttons Per Page to match the HotShot Cart grid size
