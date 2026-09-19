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
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: 'This module controls HotShot Cart audio player via HTTP API',
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
			id: 'enablePolling',
			label: 'Enable Status Polling',
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
