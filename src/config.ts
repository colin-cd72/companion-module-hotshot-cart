import { Regex, type SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	host: string
	port: string
	buttonsPerPage: number
	pages: number
	statusApiToken: string
	controlApiToken: string
	enablePolling: boolean
	pollInterval: number
	useWebSocket: boolean
	pairingCode: string
	/** Device token from `POST /api/remote/pair`; stored by the module, not typed by the user. */
	deviceToken: string
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'info',
			width: 12,
			label: 'Information',
			value:
				'This module controls HotShot Cart audio player via HTTP API. With HotShot Cart 0.2.0 or later it also receives live status over a WebSocket instead of polling.',
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Target IP',
			width: 6,
			default: 'localhost',
			regex: Regex.HOSTNAME,
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'Target Port',
			width: 6,
			default: '8080',
			regex: Regex.PORT,
		},
		{
			type: 'number',
			id: 'buttonsPerPage',
			label: 'Buttons Per Page',
			tooltip: 'Must match the grid size in HotShot Cart (rows x columns, default 4 x 6 = 24)',
			width: 6,
			default: 24,
			min: 1,
			max: 200,
		},
		{
			type: 'number',
			id: 'pages',
			label: 'Pages',
			tooltip: 'Number of pages in HotShot Cart. Variables are created for Pages x Buttons Per Page buttons.',
			width: 6,
			default: 10,
			min: 1,
			max: 20,
		},
		{
			type: 'textinput',
			id: 'statusApiToken',
			label: 'Status API Token',
			tooltip: 'Only needed when "Require API Token" is enabled in HotShot Cart. Used for status polling.',
			width: 6,
			default: '',
		},
		{
			type: 'textinput',
			id: 'controlApiToken',
			label: 'Control API Token',
			tooltip: 'Only needed when "Require API Token" is enabled in HotShot Cart. Used for play/stop/toggle/fade.',
			width: 6,
			default: '',
		},
		{
			type: 'checkbox',
			id: 'useWebSocket',
			label: 'Use live WebSocket (0.2.0+)',
			tooltip:
				'Receive status pushed by HotShot Cart 0.2.0 or later instead of polling. Needs the Control API Token (when "Require API Token" is on) or a pairing code. Falls back to polling when the WebSocket is unavailable.',
			width: 6,
			default: true,
		},
		{
			type: 'textinput',
			id: 'pairingCode',
			label: 'Pairing code',
			tooltip:
				'The code shown in HotShot Cart under Settings > Control > Remote. Used once to pair, then cleared; the module keeps the device token it receives. Not needed when a Control API Token is set.',
			width: 6,
			default: '',
			isVisible: (options) => !!options.useWebSocket,
		},
		{
			type: 'textinput',
			id: 'deviceToken',
			label: 'Device token',
			width: 6,
			default: '',
			// Filled in by the module after pairing; never shown or edited by hand
			isVisible: () => false,
		},
		{
			type: 'checkbox',
			id: 'enablePolling',
			label: 'Enable Status Polling',
			tooltip: 'Poll GET /api/status. Used when the live WebSocket is off or unavailable (older HotShot Cart).',
			width: 6,
			default: true,
		},
		{
			type: 'number',
			id: 'pollInterval',
			label: 'Poll Interval (ms)',
			width: 6,
			default: 1000,
			min: 100,
			max: 10000,
		},
	]
}
