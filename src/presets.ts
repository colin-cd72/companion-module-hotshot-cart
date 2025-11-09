import type { CompanionPresetDefinitions } from '@companion-module/base'

export function GetPresets(): CompanionPresetDefinitions {
	const presets: CompanionPresetDefinitions = {}

	for (let i = 1; i <= 12; i++) {
		presets[`play_${i}`] = {
			type: 'button',
			category: 'Play Buttons',
			name: `Play Button ${i}`,
			style: {
				text: `Play ${i}`,
				size: '18',
				color: 0xffffff,
				bgcolor: 0x000000,
			},
			steps: [
				{
					down: [
						{
							actionId: 'playButton',
							options: {
								buttonNumber: i,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'buttonState',
					options: {
						buttonNumber: i,
					},
				},
			],
		}

		presets[`toggle_${i}`] = {
			type: 'button',
			category: 'Toggle Buttons',
			name: `Toggle Button ${i}`,
			style: {
				text: `${i}`,
				size: '18',
				color: 0xffffff,
				bgcolor: 0x000000,
			},
			steps: [
				{
					down: [
						{
							actionId: 'toggleButton',
							options: {
								buttonNumber: i,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'buttonState',
					options: {
						buttonNumber: i,
					},
				},
			],
		}
	}

	return presets
}
