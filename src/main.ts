import { InstanceBase, InstanceStatus, runEntrypoint, type SomeCompanionConfigField } from '@companion-module/base'
import { GetActions } from './actions.js'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { GetFeedbacks } from './feedbacks.js'
import { GetPresets } from './presets.js'
import { GetVariableDefinitions } from './variables.js'

interface ButtonStatus {
	state: string
	label: string
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
			const status = (await this.sendCommand('/api/status', 'GET')) as {
				carts?: Array<{
					id: string
					state: string
					label: string
					fileName?: string
					progress?: number
					duration?: number
					loop?: boolean
				}>
				currentClip?: {
					id?: number
					name?: string
					fileName?: string
					state?: string
					loop?: boolean
					progress?: number
					duration?: number
				}
			}

			// Update global player variables
			if (status) {
				const globalVars: Record<string, string> = {}

				// Find currently playing clip
				let currentClip = status.currentClip
				if (!currentClip && status.carts) {
					// If no currentClip field, find first playing cart
					const playingCart = status.carts.find((cart) => cart.state === 'playing')
					if (playingCart) {
						currentClip = {
							name: playingCart.label,
							fileName: playingCart.fileName,
							state: playingCart.state,
							loop: playingCart.loop,
							progress: playingCart.progress,
							duration: playingCart.duration,
						}
					}
				}

				if (currentClip) {
					globalVars['clip_id'] = String(currentClip.id || '')
					globalVars['clip_name'] = currentClip.fileName || currentClip.name || ''
					globalVars['status'] = currentClip.state || 'idle'
					globalVars['loop'] = currentClip.loop ? 'on' : 'off'

					// Calculate timecode from progress
					const currentTime = currentClip.progress || 0
					const duration = currentClip.duration || 0
					const remaining = duration - currentTime

					// Format timecode (HH:MM:SS.FF)
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
					// No clip playing - set defaults
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

				this.setVariableValues(globalVars)
			}

			if (status?.carts) {
				this.buttonStatus = {}

				// Convert cart status to button number index
				status.carts.forEach((cart) => {
					// Extract button number from cart ID (format: page-0-cart-1)
					const match = cart.id.match(/cart-(\d+)$/)
					if (match) {
						const buttonNum = parseInt(match[1])
						this.buttonStatus[buttonNum] = {
							state: cart.state,
							label: cart.label,
						}

						// Update variables
						this.setVariableValues({
							[`button_${buttonNum}_state`]: cart.state,
							[`button_${buttonNum}_label`]: cart.label || '',
						})
					}
				})

				// Check all feedbacks
				this.checkFeedbacks('buttonState')
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err)
			this.log('debug', `Poll error: ${errorMessage}`)
		}
	}
}

runEntrypoint(HotShotCartInstance, [])
