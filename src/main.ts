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
				}>
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
