import type { CompanionActionDefinitions, CompanionInputFieldNumber } from '@companion-module/base'
import type { HotShotCartInstance } from './main.js'

export const buttonNumberOption: CompanionInputFieldNumber = {
	type: 'number',
	label: 'Button Number',
	id: 'buttonNumber',
	default: 1,
	min: 1,
	max: 999,
}

export function GetActions(instance: HotShotCartInstance): CompanionActionDefinitions {
	return {
		playButton: {
			name: 'Play Button',
			options: [buttonNumberOption],
			callback: async (action) => {
				await instance.sendCommand(`/api/button/${action.options.buttonNumber}/play`, 'POST')
			},
		},
		stopButton: {
			name: 'Stop Button',
			options: [buttonNumberOption],
			callback: async (action) => {
				await instance.sendCommand(`/api/button/${action.options.buttonNumber}/stop`, 'POST')
			},
		},
		toggleButton: {
			name: 'Toggle Button',
			options: [buttonNumberOption],
			callback: async (action) => {
				await instance.sendCommand(`/api/button/${action.options.buttonNumber}/toggle`, 'POST')
			},
		},
		fadeButton: {
			name: 'Fade Button',
			options: [
				buttonNumberOption,
				{
					type: 'number',
					label: 'Fade Duration (seconds)',
					id: 'duration',
					default: 3.0,
					min: 0.1,
					max: 30.0,
					step: 0.1,
				},
			],
			callback: async (action) => {
				await instance.sendCommand(`/api/button/${action.options.buttonNumber}/fade`, 'POST', {
					duration: action.options.duration,
				})
			},
		},
	}
}
