# companion-module-hotshot-cart

Bitfocus Companion module for controlling HotShot Cart audio player.

## Description

This module allows you to control HotShot Cart audio player from Bitfocus Companion using Stream Deck, X-keys, or any other supported control surface.

## Features

- **Play Button** - Trigger playback of any cart button
- **Stop Button** - Stop playback of any cart button
- **Toggle Button** - Toggle play/stop state of any cart button
- **Fade Button** - Fade out a cart button with customizable duration
- **Button State Feedback** - Visual feedback showing which buttons are currently playing
- **Status Polling** - Real-time status updates from HotShot Cart
- **Variables** - Access button state and labels as variables for dynamic button text
- **Presets** - Ready-to-use button presets for common scenarios

## Configuration

1. **Target IP**: The IP address of the computer running HotShot Cart (default: `localhost`)
2. **Target Port**: The HTTP API port (default: `8080`)
3. **Enable Status Polling**: Enable/disable automatic status updates (default: `true`)
4. **Poll Interval**: How often to poll for status in milliseconds (default: `1000`)

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
Starts playback of the specified button number.

**Options:**
- Button Number (1-999)

### Stop Button
Stops playback of the specified button number.

**Options:**
- Button Number (1-999)

### Toggle Button
Toggles the play/stop state of the specified button number.

**Options:**
- Button Number (1-999)

### Fade Button
Fades out the specified button over a custom duration.

**Options:**
- Button Number (1-999)
- Fade Duration (0.1-30.0 seconds)

## Feedbacks

### Button Playing State
Changes the button appearance when the cart button is playing.

**Options:**
- Button Number (1-999)

**Default Style:**
- Background Color: Green (#00ff00)
- Text Color: Black (#000000)

## Variables

The module creates variables for each button:

- `$(hotshot-cart:button_X_state)` - Current state of button X (idle/playing/stopping)
- `$(hotshot-cart:button_X_label)` - Label/name of button X

Where X is the button number (1-128).

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
- HotShot Cart application running with HTTP API enabled
- Network connectivity between Companion and HotShot Cart

## API Endpoints Used

This module uses the HotShot Cart HTTP API:

- `GET /api/status` - Retrieve all button states
- `POST /api/button/:number/play` - Play a button
- `POST /api/button/:number/stop` - Stop a button
- `POST /api/button/:number/toggle` - Toggle a button
- `POST /api/button/:number/fade` - Fade a button

## Troubleshooting

### Connection Issues

1. Verify HotShot Cart is running
2. Check the IP address and port in the module configuration
3. Ensure no firewall is blocking port 8080
4. Test the API manually:
   ```bash
   curl http://localhost:8080/api/status
   ```

### Status Not Updating

1. Enable status polling in module configuration
2. Adjust poll interval if needed (default: 1000ms)
3. Check Companion logs for error messages

### Buttons Not Responding

1. Verify the button number exists in HotShot Cart
2. Check that the HTTP API is enabled in HotShot Cart settings
3. Look at the module log in Companion for HTTP errors

## Support

For issues and feature requests, please open an issue on GitHub.

## License

MIT License - See LICENSE file for details

## Version History

### 1.0.0 (2025-01-08)
- Initial release
- Play, Stop, Toggle, and Fade actions
- Button state feedback
- Status polling
- Variables for button state and labels
- Preset buttons
