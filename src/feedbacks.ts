import type { CompanionFeedbackDefinitions } from '@companion-module/base'
import { buttonNumberOption } from './actions.js'
import type { HotShotCartInstance } from './main.js'

export function GetFeedbacks(instance: HotShotCartInstance): CompanionFeedbackDefinitions {
	return {
		buttonState: {
			type: 'boolean',
			name: 'Button Playing State',
			description: 'Change button color when button is playing',
			options: [buttonNumberOption],
			defaultStyle: {
				bgcolor: 0x00ff00,
				color: 0x000000,
			},
			callback: (feedback) => {
				const buttonNumber = Number(feedback.options.buttonNumber)
				return instance.buttonStatus[buttonNumber]?.state === 'playing'
			},
		},
	}
}
