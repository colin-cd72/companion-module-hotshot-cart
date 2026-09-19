import type { CompanionButtonPresetDefinition, CompanionPresetDefinitions } from '@companion-module/base'

const PRESET_BUTTON_COUNT = 12

function buttonPreset(
	category: string,
	name: string,
	text: string,
	actionId: string,
	buttonNumber: number
): CompanionButtonPresetDefinition {
	return {
		type: 'button',
		category,
		name,
		style: {
			text,
			size: '18',
			color: 0xffffff,
			bgcolor: 0x000000,
		},
		steps: [
			{
				down: [{ actionId, options: { buttonNumber } }],
				up: [],
			},
		],
		feedbacks: [{ feedbackId: 'buttonState', options: { buttonNumber } }],
	}
}

export function GetPresets(): CompanionPresetDefinitions {
	const presets: CompanionPresetDefinitions = {}

	for (let i = 1; i <= PRESET_BUTTON_COUNT; i++) {
		presets[`play_${i}`] = buttonPreset('Play Buttons', `Play Button ${i}`, `Play ${i}`, 'playButton', i)
		presets[`toggle_${i}`] = buttonPreset('Toggle Buttons', `Toggle Button ${i}`, `${i}`, 'toggleButton', i)
	}

	return presets
}
