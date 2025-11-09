import type { CompanionVariableDefinition } from '@companion-module/base'

export function GetVariableDefinitions(): CompanionVariableDefinition[] {
	const variables: CompanionVariableDefinition[] = []

	// Global player variables
	variables.push(
		{ variableId: 'clip_id', name: 'Currently Selected Clip Number' },
		{ variableId: 'clip_name', name: 'Currently Selected Clip File Name' },
		{ variableId: 'status', name: 'Player Status' },
		{ variableId: 'loop', name: 'Player Loop Setting' },
		{ variableId: 'timecode', name: 'Current Clip Timecode' },
		{ variableId: 'timecode_hh', name: 'Timecode Hours' },
		{ variableId: 'timecode_mm', name: 'Timecode Minutes' },
		{ variableId: 'timecode_ss', name: 'Timecode Seconds' },
		{ variableId: 'timecode_ff', name: 'Timecode Frames' },
		{ variableId: 'remaining_timecode', name: 'Remaining Time' },
		{ variableId: 'remaining_hh', name: 'Remaining Hours' },
		{ variableId: 'remaining_mm', name: 'Remaining Minutes' },
		{ variableId: 'remaining_ss', name: 'Remaining Seconds' },
		{ variableId: 'remaining_ff', name: 'Remaining Fraction' }
	)

	// Button-specific variables
	for (let i = 1; i <= 128; i++) {
		variables.push({
			variableId: `button_${i}_state`,
			name: `Button ${i} State`,
		})
		variables.push({
			variableId: `button_${i}_label`,
			name: `Button ${i} Label`,
		})
	}

	return variables
}
