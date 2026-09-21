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

	presets.flow_go = {
		type: 'button',
		category: 'Chains (Flow)',
		name: 'GO',
		style: { text: 'GO\\n$(hotshot-cart:flow_next)', size: '14', color: 0xffffff, bgcolor: 0x003322 },
		steps: [{ down: [{ actionId: 'flowGo', options: {} }], up: [] }],
		feedbacks: [{ feedbackId: 'flowRunning', options: {} }],
	}
	presets.flow_hold = {
		type: 'button',
		category: 'Chains (Flow)',
		name: 'Hold / Resume',
		style: { text: 'HOLD', size: '18', color: 0xffffff, bgcolor: 0x222233 },
		steps: [{ down: [{ actionId: 'flowHold', options: {} }], up: [] }],
		feedbacks: [{ feedbackId: 'flowRunning', options: {} }],
	}

	return presets
}
