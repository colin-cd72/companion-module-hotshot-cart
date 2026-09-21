import type { CompanionVariableDefinition, CompanionVariableValues } from '@companion-module/base'
import { formatTime, formatTimecode, splitTimecode, type CartSummary, type FlowState } from './api.js'

const BUTTON_VARIABLES: ReadonlyArray<[suffix: string, name: string]> = [
	['state', 'State'],
	['label', 'Label'],
	['artist', 'Artist'],
	['item_number', 'Item Number'],
	['track_count', 'Track Count'],
	['time_remaining', 'Time Remaining'],
	['duration', 'Duration'],
]

/** Variable definitions for the player plus every button from 1 to `buttonCount`. */
export function GetVariableDefinitions(buttonCount: number): CompanionVariableDefinition[] {
	const variables: CompanionVariableDefinition[] = [
		{ variableId: 'clip_id', name: 'Currently Playing Clip ID' },
		{ variableId: 'clip_name', name: 'Currently Playing Clip Name' },
		{ variableId: 'status', name: 'Player Status' },
		{ variableId: 'timecode', name: 'Current Clip Timecode' },
		{ variableId: 'timecode_hh', name: 'Timecode Hours' },
		{ variableId: 'timecode_mm', name: 'Timecode Minutes' },
		{ variableId: 'timecode_ss', name: 'Timecode Seconds' },
		{ variableId: 'timecode_ff', name: 'Timecode Frames' },
		{ variableId: 'remaining_timecode', name: 'Remaining Time' },
		{ variableId: 'remaining_hh', name: 'Remaining Hours' },
		{ variableId: 'remaining_mm', name: 'Remaining Minutes' },
		{ variableId: 'remaining_ss', name: 'Remaining Seconds' },
		{ variableId: 'remaining_ff', name: 'Remaining Frames' },
		{ variableId: 'flow_running', name: 'Chain Running (true/false)' },
		{ variableId: 'flow_current', name: 'Chain: Playing Button' },
		{ variableId: 'flow_next', name: 'Chain: Next Button' },
		{ variableId: 'flow_go', name: 'Chain: What GO Will Do' },
		{ variableId: 'flow_paused', name: 'Chain: Held (true/false)' },
	]

	for (let i = 1; i <= buttonCount; i++) {
		for (const [suffix, name] of BUTTON_VARIABLES) {
			variables.push({ variableId: `button_${i}_${suffix}`, name: `Button ${i} ${name}` })
		}
	}

	return variables
}

/** Global player variables for the currently playing cart, or idle values when nothing is playing. */
export function GetPlayerVariableValues(playing?: CartSummary): CompanionVariableValues {
	const elapsed = splitTimecode(playing?.elapsed ?? 0)
	const remaining = splitTimecode(playing?.timeRemaining ?? 0)

	return {
		clip_id: playing?.id ?? '',
		clip_name: playing?.label ?? '',
		status: playing?.state ?? 'idle',
		timecode: formatTimecode(playing?.elapsed ?? 0),
		timecode_hh: elapsed.hh,
		timecode_mm: elapsed.mm,
		timecode_ss: elapsed.ss,
		timecode_ff: elapsed.ff,
		remaining_timecode: formatTimecode(playing?.timeRemaining ?? 0),
		remaining_hh: remaining.hh,
		remaining_mm: remaining.mm,
		remaining_ss: remaining.ss,
		remaining_ff: remaining.ff,
	}
}

/** Variables for one button, or idle values when no cart is loaded there. */
export function GetButtonVariableValues(buttonNumber: number, cart?: CartSummary): CompanionVariableValues {
	const prefix = `button_${buttonNumber}_`
	return {
		[`${prefix}state`]: cart?.state ?? 'idle',
		[`${prefix}label`]: cart?.label ?? '',
		[`${prefix}artist`]: cart?.artist ?? '',
		[`${prefix}item_number`]: cart?.itemNumber ?? '',
		[`${prefix}track_count`]: cart?.trackCount ?? 0,
		[`${prefix}time_remaining`]: formatTime(cart?.timeRemaining ?? 0),
		[`${prefix}duration`]: formatTime(cart?.duration ?? 0),
	}
}

/** Chain variables from `GET /api/flow`, or idle values when the app has no chain running (or is too old). */
export function GetFlowVariableValues(flow?: FlowState): CompanionVariableValues {
	const running = !!flow?.running
	return {
		flow_running: running ? 'true' : 'false',
		flow_current: running ? (flow?.currentLabel ?? '') : '',
		flow_next: running ? (flow?.nextLabel ?? '') : '',
		flow_go: running ? (flow?.goLabel ?? '') : '',
		flow_paused: running && flow?.paused ? 'true' : 'false',
	}
}

/** Every variable at its idle value, used until the first status poll arrives. */
export function GetDefaultVariableValues(buttonCount: number): CompanionVariableValues {
	const values = { ...GetPlayerVariableValues(), ...GetFlowVariableValues() }
	for (let i = 1; i <= buttonCount; i++) {
		Object.assign(values, GetButtonVariableValues(i))
	}
	return values
}
