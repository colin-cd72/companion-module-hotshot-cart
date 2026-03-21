import { InstanceBase, InstanceStatus, runEntrypoint, type SomeCompanionConfigField } from '@companion-module/base'
import { GetActions } from './actions.js'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { GetFeedbacks } from './feedbacks.js'
import { GetPresets } from './presets.js'
import { GetVariableDefinitions } from './variables.js'

interface ButtonStatus {
	state: string
	label: string
	artist: string
	itemNumber: string
	trackCount: number
	timeRemaining: number
	duration: number
}

export class HotShotCartInstance extends InstanceBase<ModuleConfig> {
	public config!: ModuleConfig
	public buttonStatus: Record<number, ButtonStatus> = {}
	private pollInterval?: NodeJS.Timeout

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config

		this.updateStatus(InstanceStatus.Ok)
		this.updateActions()
		this.updateFeedbacks()
		this.updateVariables()
		this.updatePresets()

		// Start polling for status if enabled
		if (this.config.enablePolling) {
			this.startPolling()
		}
	}

	async destroy(): Promise<void> {
		if (this.pollInterval) {
			clearInterval(this.pollInterval)
		}
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config

		this.updateActions()
		this.updateFeedbacks()

		if (this.pollInterval) {
			clearInterval(this.pollInterval)
		}

		if (this.config.enablePolling) {
			this.startPolling()
		}
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		this.setActionDefinitions(GetActions(this))
	}

	updateFeedbacks(): void {
		this.setFeedbackDefinitions(GetFeedbacks(this))
	}

	updateVariables(): void {
		this.setVariableDefinitions(GetVariableDefinitions())

		// Initialize button variables with defaults
		const defaultVars: Record<string, string | number> = {}
		for (let i = 1; i <= 128; i++) {
			defaultVars[`button_${i}_state`] = 'idle'
			defaultVars[`button_${i}_label`] = ''
			defaultVars[`button_${i}_artist`] = ''
			defaultVars[`button_${i}_item_number`] = ''
			defaultVars[`button_${i}_track_count`] = 0
			defaultVars[`button_${i}_time_remaining`] = ''
			defaultVars[`button_${i}_duration`] = ''
		}
		this.setVariableValues(defaultVars)
	}

	updatePresets(): void {
		this.setPresetDefinitions(GetPresets())
	}

	async sendCommand(path: string, method: 'GET' | 'POST' = 'GET', body?: Record<string, unknown>): Promise<unknown> {
		const url = `http://${this.config.host}:${this.config.port}${path}`

		try {
			const options: RequestInit = {
				method: method,
				headers: {
					'Content-Type': 'application/json',
				},
			}

			if (body) {
				options.body = JSON.stringify(body)
			}

			const response = await fetch(url, options)

			if (!response.ok) {
				this.log('error', `HTTP Error: ${response.status} ${response.statusText}`)
				this.updateStatus(InstanceStatus.UnknownWarning, `HTTP Error: ${response.status}`)
			} else {
				this.updateStatus(InstanceStatus.Ok)
			}

			return await response.json()
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err)
			this.log('error', `Network error: ${errorMessage}`)
			this.updateStatus(InstanceStatus.ConnectionFailure, errorMessage)
		}
	}

	startPolling(): void {
		if (this.pollInterval) {
			clearInterval(this.pollInterval)
		}

		this.pollInterval = setInterval(() => {
			this.pollStatus()
		}, this.config.pollInterval || 1000)

		// Poll immediately
		this.pollStatus()
	}

	async pollStatus(): Promise<void> {
		try {
			// API returns Record<cartId, cartStatus>
			const statusData = (await this.sendCommand('/api/status', 'GET')) as Record<
				string,
				{
					state: string
					fileName: string
					label: string
					artist: string
					itemNumber: string
					trackCount: number
					channels: number
					duration: number
					elapsed: number
					progress: number
					timeRemaining: number
					fileTracks: Array<{
						fileName: string
						state: string
						duration: number
						elapsed: number
						progress: number
						timeRemaining: number
						channels: number
						fileId: string
					}>
				}
			>

			if (!statusData) {
				return
			}

			// Convert the object format to array format
			const carts = Object.entries(statusData).map(([id, data]) => {
				const actualFileName = data.fileName || (data.fileTracks?.[0]?.fileName ?? '')
				const trackData = data.fileTracks?.[0]
				const actualDuration = data.duration || trackData?.duration || 0
				const actualElapsed = data.elapsed || trackData?.elapsed || 0
				const actualTimeRemaining = data.timeRemaining || trackData?.timeRemaining || 0
				const actualState = data.state !== 'idle' ? data.state : (trackData?.state ?? 'idle')

				return {
					id,
					...data,
					fileName: actualFileName,
					duration: actualDuration,
					elapsed: actualElapsed,
					timeRemaining: actualTimeRemaining,
					state: actualState,
				}
			})

			// Update global player variables
			const globalVars: Record<string, string | number> = {}

			// Find currently playing clip
			const playingCart = carts.find((cart) => cart.state === 'playing')

			if (playingCart) {
				globalVars['clip_id'] = playingCart.id
				globalVars['clip_name'] = playingCart.label || playingCart.fileName
				globalVars['status'] = playingCart.state
				globalVars['loop'] = 'off'

				const currentTime = playingCart.elapsed
				const remaining = playingCart.timeRemaining

				const formatTimecode = (seconds: number): string => {
					const hrs = Math.floor(seconds / 3600)
					const mins = Math.floor((seconds % 3600) / 60)
					const secs = Math.floor(seconds % 60)
					const frames = Math.floor((seconds % 1) * 100)
					return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(frames).padStart(2, '0')}`
				}

				globalVars['timecode'] = formatTimecode(currentTime)
				globalVars['timecode_hh'] = String(Math.floor(currentTime / 3600)).padStart(2, '0')
				globalVars['timecode_mm'] = String(Math.floor((currentTime % 3600) / 60)).padStart(2, '0')
				globalVars['timecode_ss'] = String(Math.floor(currentTime % 60)).padStart(2, '0')
				globalVars['timecode_ff'] = String(Math.floor((currentTime % 1) * 100)).padStart(2, '0')

				globalVars['remaining_timecode'] = formatTimecode(remaining)
				globalVars['remaining_hh'] = String(Math.floor(remaining / 3600)).padStart(2, '0')
				globalVars['remaining_mm'] = String(Math.floor((remaining % 3600) / 60)).padStart(2, '0')
				globalVars['remaining_ss'] = String(Math.floor(remaining % 60)).padStart(2, '0')
				globalVars['remaining_ff'] = String(Math.floor((remaining % 1) * 100)).padStart(2, '0')
			} else {
				globalVars['clip_id'] = ''
				globalVars['clip_name'] = ''
				globalVars['status'] = 'idle'
				globalVars['loop'] = 'off'
				globalVars['timecode'] = '00:00:00.00'
				globalVars['timecode_hh'] = '00'
				globalVars['timecode_mm'] = '00'
				globalVars['timecode_ss'] = '00'
				globalVars['timecode_ff'] = '00'
				globalVars['remaining_timecode'] = '00:00:00.00'
				globalVars['remaining_hh'] = '00'
				globalVars['remaining_mm'] = '00'
				globalVars['remaining_ss'] = '00'
				globalVars['remaining_ff'] = '00'
			}

			// Helper to format time as MM:SS
			const formatTime = (seconds: number): string => {
				if (!seconds || seconds <= 0) return ''
				const mins = Math.floor(seconds / 60)
				const secs = Math.floor(seconds % 60)
				return `${mins}:${String(secs).padStart(2, '0')}`
			}

			// Update button status
			this.buttonStatus = {}

			carts.forEach((cart) => {
				// Extract page and cart number from cart ID (format: page-0-cart-1)
				const match = cart.id.match(/page-(\d+)-cart-(\d+)$/)
				if (match) {
					const pageNum = parseInt(match[1])
					const cartNum = parseInt(match[2])
					// Calculate flat button number: page 0 = 1-24, page 1 = 25-48, etc.
					const buttonNum = pageNum * 24 + cartNum

					this.buttonStatus[buttonNum] = {
						state: cart.state,
						label: cart.label || cart.fileName || '',
						artist: cart.artist || '',
						itemNumber: cart.itemNumber || '',
						trackCount: cart.trackCount || 0,
						timeRemaining: cart.timeRemaining || 0,
						duration: cart.duration || 0,
					}

					globalVars[`button_${buttonNum}_state`] = cart.state
					globalVars[`button_${buttonNum}_label`] = cart.label || cart.fileName || ''
					globalVars[`button_${buttonNum}_artist`] = cart.artist || ''
					globalVars[`button_${buttonNum}_item_number`] = cart.itemNumber || ''
					globalVars[`button_${buttonNum}_track_count`] = cart.trackCount || 0
					globalVars[`button_${buttonNum}_time_remaining`] = formatTime(cart.timeRemaining)
					globalVars[`button_${buttonNum}_duration`] = formatTime(cart.duration)
				}
			})

			this.setVariableValues(globalVars)
			this.checkFeedbacks('buttonState')
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err)
			this.log('debug', `Poll error: ${errorMessage}`)
		}
	}
}

runEntrypoint(HotShotCartInstance, [])
