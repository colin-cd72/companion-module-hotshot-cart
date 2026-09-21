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
			description:
				'Start playback. From HotShot Cart 0.1.8 a button with Solo mode stops the other playing buttons, whether started here or in the app.',
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
			description: 'Play if idle, fade if playing. Solo mode applies when it starts playback (HotShot Cart 0.1.8+).',
			options: [buttonNumberOption],
			callback: async (action) => {
				await instance.sendCommand(`/api/button/${action.options.buttonNumber}/toggle`, 'POST')
			},
		},
		flowGo: {
			name: 'Flow: GO',
			description:
				"Advance the running chain now, exactly like Space in the app: crossfade, fade, gap or cut into the next button, or the chain's end action on the last one. Needs HotShot Cart 0.1.11+.",
			options: [],
			callback: async () => {
				await instance.sendCommand('/api/flow/go', 'POST')
			},
		},
		flowHold: {
			name: 'Flow: Hold / Resume',
			description:
				"Pause the chain's playing button without advancing; press again to resume. Needs HotShot Cart 0.1.11+.",
			options: [],
			callback: async () => {
				await instance.sendCommand('/api/flow/hold', 'POST')
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
