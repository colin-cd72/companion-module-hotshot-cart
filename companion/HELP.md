# HotShot Cart

Control HotShot Cart professional audio cart player from Bitfocus Companion.

## Configuration

- **Target IP**: IP address of the computer running HotShot Cart (default: `localhost`)
- **Target Port**: HTTP API port configured in HotShot Cart (default: `8080`)
- **Enable Polling**: Enable real-time status updates (default: enabled)
- **Poll Interval**: How often to check status in milliseconds (default: `1000`)

## Actions

| Action | Description |
|--------|-------------|
| **Play Button** | Start playback of a cart button (1-999) |
| **Stop Button** | Stop playback of a cart button |
| **Toggle Button** | Toggle play/stop state |
| **Fade Button** | Fade out with custom duration (0.1-30 seconds) |

## Feedbacks

| Feedback | Description |
|----------|-------------|
| **Button Playing State** | Shows green when the specified button is playing |

## Variables

### Global Variables
- `$(hotshot-cart:clip_name)` - Currently playing clip name
- `$(hotshot-cart:status)` - Player status (idle/playing)
- `$(hotshot-cart:timecode)` - Current timecode
- `$(hotshot-cart:remaining_timecode)` - Time remaining

### Button Variables (X = 1-128)
- `$(hotshot-cart:button_X_state)` - Playback state
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
- **Status Not Updating**: Enable polling in module configuration
- **Buttons Not Responding**: Check that HTTP API is enabled in HotShot Cart settings
