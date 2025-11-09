import type { CompanionVariableDefinition } from '@companion-module/base'

export function GetVariableDefinitions(): CompanionVariableDefinition[] {
	const variables: CompanionVariableDefinition[] = []

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
