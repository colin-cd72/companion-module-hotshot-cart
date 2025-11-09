import type { CompanionFeedbackDefinitions } from '@companion-module/base'
import type { HotShotCartInstance } from './main.js'

export function GetFeedbacks(instance: HotShotCartInstance): CompanionFeedbackDefinitions {
	return {
		buttonState: {
			type: 'boolean',
			name: 'Button Playing State',
			description: 'Change button color when button is playing',
			options: [
				{
					type: 'number',
					label: 'Button Number',
					id: 'buttonNumber',
					default: 1,
					min: 1,
					max: 999,
				},
			],
			defaultStyle: {
				bgcolor: 0x00ff00,
				color: 0x000000,
			},
			callback: (feedback) => {
				const buttonNum = feedback.options.buttonNumber as number
				const status = instance.buttonStatus?.[buttonNum]
				return status?.state === 'playing'
			},
		},
	}
}
