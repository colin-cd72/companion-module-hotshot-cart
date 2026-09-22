# companion-module-hotshot-cart

Bitfocus Companion module for controlling HotShot Cart audio player.

## Description

This module allows you to control HotShot Cart audio player from Bitfocus Companion using Stream Deck, X-keys, or any other supported control surface.

## Features

- **Play Button** - Trigger playback of any cart button
- **Stop Button** - Stop playback of any cart button
- **Toggle Button** - Play a cart button if idle, fade it out if playing
- **Fade Button** - Fade out a cart button with customizable duration
- **Flow: GO / Hold** and **Stop All** - Advance or hold a HotShot Cart chain, or stop everything (HotShot Cart 0.1.11+)
- **Button State Feedback** - Visual feedback showing which buttons are currently playing
- **Live Status Feed** - Status pushed over a WebSocket by HotShot Cart 0.2.0 or later, with polling as the fallback for older versions
- **Status Polling** - Real-time status updates from HotShot Cart
- **Variables** - Access button state and labels as variables for dynamic button text
- **Presets** - Ready-to-use button presets for common scenarios

## Configuration

1. **Target IP**: The IP address of the computer running HotShot Cart (default: `localhost`)
2. **Target Port**: The HTTP API port (default: `8080`)
3. **Buttons Per Page**: Must match the grid size in HotShot Cart, rows x columns (default: `24`)
4. **Pages**: Number of pages in HotShot Cart. Variables are created for Pages x Buttons Per Page buttons (default: `10`, giving 240 buttons)
5. **Status API Token** / **Control API Token**: Only needed when "Require API Token" is enabled in HotShot Cart. The status token is sent when polling, the control token for play/stop/toggle/fade. If only one is set it is used for both.
6. **Use live WebSocket (0.2.0+)**: Receive status pushed by HotShot Cart over `ws://host:port/api/ws` instead of polling (default: `true`). Needs HotShot Cart 0.2.0 or later with **Remote** turned on (Settings > Control > Remote). When the socket cannot be opened the module polls as before, so leaving this on is safe with older versions.
7. **Pairing code**: The code HotShot Cart shows under Settings > Control > Remote. The module pairs once (`POST /api/remote/pair`, device name "Companion"), stores the device token it receives in the connection and clears this field. Not needed when a **Control API Token** is set and "Require API Token" is on in HotShot Cart: the WebSocket accepts that token directly.
8. **Enable Status Polling**: Enable/disable polling `GET /api/status` (default: `true`). Used while the live feed is off or unavailable
9. **Poll Interval**: How often to poll for status in milliseconds (default: `1000`)

### Live feed or polling?

With the live feed the module gets a `playback` message from HotShot Cart the moment anything changes (ten times a second at most), a `session` snapshot plus `patch` diffs when labels, artists, item numbers or files are edited, and `flow` messages for the chain. The variables and feedbacks are the same as with polling; they just update sooner and without a request every second.

The WebSocket needs a credential:

- **Control API Token** (preferred, if you already use one): sent as `?token=`; HotShot Cart accepts it only while "Require API Token" is on.
- **Device token from pairing**: turn on Remote in HotShot Cart, type the pairing code into the module, save. The module logs `Paired with <host>` and keeps the token. Use **Forget** on the device in HotShot Cart to revoke it; the module then asks for the code again.

While the socket is open the poll timer is stopped. Whenever it closes (HotShot Cart quit, network gone, Remote turned off) polling resumes at once and the module reconnects with a 1 to 10 second backoff. A HotShot Cart older than 0.2.0 answers 404 for `/api/ws`; the module logs that once and simply polls.

## Development

This module is written in TypeScript and follows the Bitfocus Companion TypeScript module template.

### Building

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build the module:

   ```bash
   npm run build
   ```

3. Watch mode for development:

   ```bash
   npm run dev
   ```

4. Lint the code:

   ```bash
   npm run lint
   ```

5. Format the code:
   ```bash
   npm run format
   ```

### Installation in Companion

1. Link to Companion's module directory:

   ```bash
   # Find your Companion installation directory
   # On macOS: ~/Library/Application Support/companion-module-dev
   # On Windows: %APPDATA%/companion-module-dev
   # On Linux: ~/.local/share/companion-module-dev

   # Build the module first
   npm run build

   # Create a symlink
   ln -s "/path/to/companion-module-hotshot-cart" \
         ~/Library/Application\ Support/companion-module-dev/hotshot-cart
   ```

2. Restart Bitfocus Companion

3. The module should appear in the Connections list

## Available Actions

### Play Button

Starts playback of the specified button number. If the button has **Solo Mode** enabled in HotShot Cart, every other playing button is stopped first, except the buttons it triggers. Solo applies to Companion triggers from HotShot Cart 0.1.8 on; earlier versions only applied it to clicks in the app.

**Options:**

- Button Number (1-999)

### Stop Button

Stops playback of the specified button number.

**Options:**

- Button Number (1-999)

### Toggle Button

Plays the specified button if it is idle, or fades it out (2 seconds) if it is playing. When it starts playback, Solo Mode applies as for Play Button.

**Options:**

- Button Number (1-999)

### Flow: GO

Advances the running chain, exactly like Space in HotShot Cart: crossfade, fade, gap or cut into the next button, or the chain's "At the end" action on the last one. Nothing happens when no chain is running. Needs HotShot Cart 0.1.11 or later.

### Flow: Hold / Resume

Pauses the chain's playing button without advancing; again to resume. Needs HotShot Cart 0.1.11 or later.

### Stop All

The panic button: stops every playing button at once and ends any running chain, the same as **STOP ALL** or Escape in HotShot Cart. Needs HotShot Cart 0.1.11 or later.

### Fade Button

Fades out the specified button over a custom duration.

**Options:**

- Button Number (1-999)
- Fade Duration (0.1-30.0 seconds)

## Feedbacks

### Chain Running

Lights a key while a chain is running; pair it with the Flow: GO action.

### Button Playing State

Changes the button appearance when the cart button is playing.

**Options:**

- Button Number (1-999)

**Default Style:**

- Background Color: Green (#00ff00)
- Text Color: Black (#000000)

## Variables

### Chain (Flow) Variables

- `$(hotshot-cart:flow_running)` - `true` while a chain is running
- `$(hotshot-cart:flow_current)` - Name of the chain's playing button
- `$(hotshot-cart:flow_next)` - Name of the next button in the chain
- `$(hotshot-cart:flow_go)` - What GO will do, e.g. `Crossfade 3s` or `Pause (end of chain)`
- `$(hotshot-cart:flow_paused)` - `true` while the chain is held

### Global Variables

- `$(hotshot-cart:clip_id)` - Currently playing clip ID
- `$(hotshot-cart:clip_name)` - Currently playing clip name
- `$(hotshot-cart:status)` - Player status (idle/playing)
- `$(hotshot-cart:timecode)` - Current timecode (HH:MM:SS.FF)
- `$(hotshot-cart:timecode_hh)` - Timecode hours
- `$(hotshot-cart:timecode_mm)` - Timecode minutes
- `$(hotshot-cart:timecode_ss)` - Timecode seconds
- `$(hotshot-cart:timecode_ff)` - Timecode frames
- `$(hotshot-cart:remaining_timecode)` - Remaining time (HH:MM:SS.FF)
- `$(hotshot-cart:remaining_hh)` - Remaining hours
- `$(hotshot-cart:remaining_mm)` - Remaining minutes
- `$(hotshot-cart:remaining_ss)` - Remaining seconds
- `$(hotshot-cart:remaining_ff)` - Remaining frames

### Button Variables (X = 1 to Pages x Buttons Per Page, 240 by default)

- `$(hotshot-cart:button_X_state)` - Current state (idle/playing/paused/stopping/fading/error)
- `$(hotshot-cart:button_X_label)` - Button label/name
- `$(hotshot-cart:button_X_artist)` - Artist name
- `$(hotshot-cart:button_X_item_number)` - User-defined item number
- `$(hotshot-cart:button_X_track_count)` - Number of audio tracks
- `$(hotshot-cart:button_X_time_remaining)` - Time remaining (MM:SS)
- `$(hotshot-cart:button_X_duration)` - Total duration (MM:SS)

## Presets

The module includes ready-to-use presets:

### Play Buttons (1-12)

- Simple play buttons with state feedback
- Click to play the corresponding cart button

### Toggle Buttons (1-12)

- Toggle buttons with state feedback
- Click to toggle play/stop state
- Shows green when playing

## Usage Example

### Basic Setup

1. Add HotShot Cart connection in Companion
2. Configure the IP address and port
3. Create buttons using the presets or custom actions
4. Assign to your Stream Deck pages

### Example Button Configuration

**Toggle Button with Feedback:**

1. Add action: "Toggle Button" with Button Number: 1
2. Add feedback: "Button Playing State" with Button Number: 1
3. The button will turn green when cart button 1 is playing

**Multi-Action Button:**

1. Button Down: Play Button 1
2. Button Up: Fade Button 1 (3.0 seconds)
3. This creates a button that plays on press and fades on release

## Requirements

- Bitfocus Companion 3.0 or later
- HotShot Cart application running with HTTP API enabled (0.1.8 or later for Solo Mode to apply to Companion triggers, 0.2.0 or later for the live WebSocket feed)
- If HotShot Cart requires API tokens, the same tokens entered in the module configuration
- Network connectivity between Companion and HotShot Cart

## API Endpoints Used

This module uses the HotShot Cart HTTP API:

- `GET /api/status` - Retrieve all button states (polling)
- `ws://host:port/api/ws?token=...` - Live feed: `session`, `patch`, `playback` and `flow` messages (0.2.0+)
- `POST /api/remote/pair` - Exchange a pairing code for a device token (0.2.0+)
- `POST /api/button/:number/play` - Play a button
- `POST /api/button/:number/stop` - Stop a button
- `POST /api/button/:number/toggle` - Toggle a button
- `POST /api/button/:number/fade` - Fade a button
- `GET /api/flow` - The running chain (0.1.11+)
- `POST /api/flow/go` - Advance the chain, like Space (0.1.11+)
- `POST /api/flow/hold` - Hold or resume the chain's playing button (0.1.11+)
- `POST /api/stop-all` - Stop every playing button and end the chain (0.1.11+)

## Troubleshooting

### Connection Issues

1. Verify HotShot Cart is running
2. Check the IP address and port in the module configuration
3. Ensure no firewall is blocking port 8080
4. If HotShot Cart requires API tokens, check the tokens match (the module log shows `HTTP 401` or `HTTP 403` when they do not)
5. Test the API manually:
   ```bash
   curl http://localhost:8080/api/status
   ```

### Status Not Updating

1. Enable status polling in module configuration (or the live WebSocket with HotShot Cart 0.2.0+)
2. Adjust poll interval if needed (default: 1000ms)
3. Check Companion logs for error messages

### Live Feed Not Connecting

1. The module log says `Live feed connected` when the WebSocket is open; until then it polls
2. `HotShot Cart has no live feed`: update HotShot Cart to 0.2.0 or later and turn on Remote (Settings > Control > Remote)
3. `Pairing failed: wrong pairing code`: re-read the code in HotShot Cart (it changes when Remote is turned off and on) and enter it again
4. `refused the Control API Token`: HotShot Cart only accepts it while "Require API Token" is on; either turn that on or pair with the code
5. `no longer accepts the stored device token`: the device was forgotten in HotShot Cart; enter the pairing code again
6. If HotShot Cart's grid is not Buttons Per Page wide the module logs the size it sees; set Buttons Per Page to match

### Buttons Not Responding

1. Verify the button number exists in HotShot Cart
2. Check that Buttons Per Page matches the grid size in HotShot Cart
3. Check that the HTTP API is enabled in HotShot Cart settings
4. Look at the module log in Companion for HTTP errors

## Support

For issues and feature requests, please open an issue on GitHub.

## License

MIT License - See LICENSE file for details

## Version History

### 1.4.0 (2026-09-22)

- Added a live status feed over the HotShot Cart 0.2.0 WebSocket (`/api/ws`): button states, labels, timecode and chain variables update the moment they change instead of once a second. Polling stops while the socket is open and resumes whenever it closes, so older HotShot Cart versions keep working unchanged
- Added **Use live WebSocket (0.2.0+)** (default on) and **Pairing code** to the configuration. The module pairs once with the code shown in HotShot Cart, stores the device token and clears the code; a Control API Token is used instead when one is set and HotShot Cart requires API tokens
- Labels, artists and item numbers edited in HotShot Cart arrive through the session mirror, including for buttons that have no audio loaded
- A warning is logged when the HotShot Cart grid size does not match Buttons Per Page

### 1.3.0 (2026-09-20)

- Added **Flow: GO** and **Flow: Hold / Resume** actions, a **Chain Running** feedback, `flow_*` variables and two presets, so a Stream Deck key or footswitch advances a HotShot Cart chain the way Space does. Needs HotShot Cart 0.1.11; older versions are detected and simply not polled for it
- Added a **Stop All** action and preset (the app's panic button: every playing button stops and the chain ends). Needs HotShot Cart 0.1.11

### 1.2.2 (2026-09-20)

- The Button Playing State feedback and the global clip variables now stay on while a button is fading out, not only while it is playing
- Verified against HotShot Cart 0.1.11: the Fade Button action needs 0.1.11 or later (earlier versions rejected the request body Companion sends)

### 1.2.1 (2026-09-20)

- Documented HotShot Cart 0.1.8 behavior: Play and Toggle now honor a button's **Solo Mode**, stopping the other playing buttons, the same as a click in the app. No API changes; the module works unchanged with 0.1.8
- Action descriptions in Companion mention Solo Mode

### 1.2.0 (2026-09-19)

- Added **Buttons Per Page** and **Pages** configuration so the module matches the HotShot Cart grid; variables now cover every cart (default 10 pages x 24)
- Added **Status API Token** and **Control API Token** for HotShot Cart installs that require API tokens
- Removed the `loop` variable, which HotShot Cart never reported
- Polling no longer piles up requests on a slow host: one request in flight, 5 second timeout
- Only changed variables are sent to Companion on each poll; buttons that disappear from the status revert to idle
- HTTP errors are reported as warnings instead of connection failures
- Switched to the Bitfocus shared ESLint config and added a LICENSE file

### 1.1.0 (2025-03-21)

- Added new button variables:
  - `button_X_artist` - Artist name
  - `button_X_item_number` - User-defined item number
  - `button_X_track_count` - Number of audio tracks
  - `button_X_time_remaining` - Formatted time remaining (MM:SS)
  - `button_X_duration` - Formatted duration (MM:SS)
- Added global timecode and remaining time variables
- Improved API response parsing for latest HotShot Cart API
- Fixed button number calculation for multi-page layouts

### 1.0.0 (2025-01-08)

- Initial release
- Play, Stop, Toggle, and Fade actions
- Button state feedback
- Status polling
- Variables for button state and labels
- Preset buttons
