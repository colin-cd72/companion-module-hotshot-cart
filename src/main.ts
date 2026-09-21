import {
	InstanceBase,
	InstanceStatus,
	runEntrypoint,
	type CompanionVariableValues,
	type SomeCompanionConfigField,
} from '@companion-module/base'
import { GetActions } from './actions.js'
import {
	DEFAULT_BUTTONS_PER_PAGE,
	DEFAULT_PAGES,
	REQUEST_TIMEOUT_MS,
	cartIdToButtonNumber,
	summarizeCart,
	type CartSummary,
	type FlowState,
	type StatusResponse,
} from './api.js'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { GetFeedbacks } from './feedbacks.js'
import { GetPresets } from './presets.js'
import {
	GetButtonVariableValues,
	GetDefaultVariableValues,
	GetFlowVariableValues,
	GetPlayerVariableValues,
	GetVariableDefinitions,
} from './variables.js'

const DEFAULT_POLL_INTERVAL_MS = 1000

export class HotShotCartInstance extends InstanceBase<ModuleConfig> {
	public config!: ModuleConfig
	/** Latest known status for each flat button number, refreshed by polling. */
	public buttonStatus: Record<number, CartSummary> = {}
	/** Latest chain state from `GET /api/flow`; idle when the app is older than 0.1.11. */
	public flow: FlowState = { running: false }
	/** Set once the app answers 404 for /api/flow, so old versions are not polled for it. */
	private flowUnsupported = false

	/** Number of buttons variables are currently registered for (Pages x Buttons Per Page). */
	private buttonCount = 0

	private pollTimer?: NodeJS.Timeout
	private pollInFlight = false

	async init(config: ModuleConfig): Promise<void> {
		this.config = config

		this.setActionDefinitions(GetActions(this))
		this.setFeedbackDefinitions(GetFeedbacks(this))
		this.setPresetDefinitions(GetPresets())
		this.applyVariableLayout()
		this.applyPollingConfig()
	}

	async destroy(): Promise<void> {
		this.stopPolling()
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config
		this.applyVariableLayout()
		this.applyPollingConfig()
	}

	private get buttonsPerPage(): number {
		return this.config.buttonsPerPage || DEFAULT_BUTTONS_PER_PAGE
	}

	/** (Re)register button variables when the configured page layout changes. */
	private applyVariableLayout(): void {
		const buttonCount = this.buttonsPerPage * (this.config.pages || DEFAULT_PAGES)
		if (buttonCount === this.buttonCount) return

		this.buttonCount = buttonCount
		this.buttonStatus = {}
		this.setVariableDefinitions(GetVariableDefinitions(buttonCount))
		// Full set (not diffed): definitions were just replaced, so every value must be sent again
		this.setVariableValues(GetDefaultVariableValues(buttonCount))
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	private applyPollingConfig(): void {
		if (this.config.enablePolling) {
			this.updateStatus(InstanceStatus.Connecting)
			this.startPolling()
		} else {
			this.stopPolling()
			// Without polling there is nothing to verify the connection against
			this.updateStatus(InstanceStatus.Ok)
		}
	}

	async sendCommand(
		path: string,
		method: 'GET' | 'POST' = 'GET',
		body?: Record<string, unknown>,
		options: { quiet404?: boolean } = {}
	): Promise<unknown> {
		const url = `http://${this.config.host}:${this.config.port}${path}`

		const headers: Record<string, string> = {}
		if (body) headers['Content-Type'] = 'application/json'
		const token = this.apiTokenFor(method)
		if (token) headers['x-api-token'] = token

		let response: Response
		try {
			response = await fetch(url, {
				method,
				headers,
				body: body ? JSON.stringify(body) : undefined,
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			})
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			this.log('error', `Network error for ${method} ${path}: ${message}`)
			this.updateStatus(InstanceStatus.ConnectionFailure, message)
			return undefined
		}

		if (!response.ok) {
			if (response.status === 404 && options.quiet404) return null
			this.log('error', `HTTP ${response.status} ${response.statusText} for ${method} ${path}`)
			this.updateStatus(InstanceStatus.UnknownWarning, `HTTP ${response.status}`)
			return undefined
		}

		this.updateStatus(InstanceStatus.Ok)

		const text = await response.text()
		if (!text) return undefined
		try {
			return JSON.parse(text) as unknown
		} catch {
			this.log('warn', `Non-JSON response for ${method} ${path}`)
			return undefined
		}
	}

	/**
	 * HotShot Cart can require separate tokens for status (GET) and control (POST) access.
	 * If only one token is configured it is used for both.
	 */
	private apiTokenFor(method: 'GET' | 'POST'): string | undefined {
		const status = this.config.statusApiToken?.trim()
		const control = this.config.controlApiToken?.trim()
		return (method === 'GET' ? status || control : control || status) || undefined
	}

	private startPolling(): void {
		this.stopPolling()

		const interval = this.config.pollInterval || DEFAULT_POLL_INTERVAL_MS
		this.pollTimer = setInterval(() => void this.pollStatus(), interval)
		void this.pollStatus()
	}

	private stopPolling(): void {
		if (this.pollTimer) {
			clearInterval(this.pollTimer)
			this.pollTimer = undefined
		}
	}

	private async pollStatus(): Promise<void> {
		// Skip this tick if the previous request is still outstanding so slow hosts don't pile up requests
		if (this.pollInFlight) return
		this.pollInFlight = true

		try {
			const statusData = (await this.sendCommand('/api/status')) as StatusResponse | undefined
			if (!statusData || typeof statusData !== 'object') return

			this.applyStatus(statusData)
			await this.pollFlow()
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			this.log('debug', `Poll error: ${message}`)
		} finally {
			this.pollInFlight = false
		}
	}

	/** Chain state, on apps that have it. A 404 means an older app: stop asking. */
	private async pollFlow(): Promise<void> {
		if (this.flowUnsupported) return
		const flow = (await this.sendCommand('/api/flow', 'GET', undefined, { quiet404: true })) as
			FlowState | null | undefined
		if (flow === null) {
			this.flowUnsupported = true
			this.log('info', 'This HotShot Cart has no chain (Flow) API; update to 0.1.11 or later for GO from Companion')
			return
		}
		if (!flow || typeof flow !== 'object') return
		const wasRunning = this.flow.running
		this.flow = flow
		this.setChangedVariableValues(GetFlowVariableValues(flow))
		if (wasRunning !== !!flow.running) this.checkFeedbacks('flowRunning')
	}

	private applyStatus(statusData: StatusResponse): void {
		const buttonStatus: Record<number, CartSummary> = {}
		const { buttonsPerPage, buttonCount } = this
		let playingCart: CartSummary | undefined

		for (const [id, data] of Object.entries(statusData)) {
			const cart = summarizeCart(id, data)
			const buttonNumber = cartIdToButtonNumber(id, buttonsPerPage)

			if (buttonNumber === undefined) {
				this.log('debug', `Ignoring cart with unrecognised id: ${id}`)
				continue
			}
			if (buttonNumber > buttonCount) {
				this.log(
					'debug',
					`Ignoring cart ${id}: button ${buttonNumber} exceeds Pages x Buttons Per Page (${buttonCount})`
				)
				continue
			}

			buttonStatus[buttonNumber] = cart
			if (!playingCart && (cart.state === 'playing' || cart.state === 'fading')) playingCart = cart
		}

		// Build the full variable set so buttons that disappeared from the status revert to idle
		const values = GetPlayerVariableValues(playingCart)
		for (let i = 1; i <= buttonCount; i++) {
			Object.assign(values, GetButtonVariableValues(i, buttonStatus[i]))
		}

		this.buttonStatus = buttonStatus

		const changed = this.setChangedVariableValues(values)
		if (changed.some((id) => id.endsWith('_state'))) {
			this.checkFeedbacks('buttonState')
		}
	}

	/** Send only variables whose value differs from the last value Companion was given. */
	private setChangedVariableValues(values: CompanionVariableValues): string[] {
		const changed: CompanionVariableValues = {}
		for (const [id, value] of Object.entries(values)) {
			if (this.getVariableValue(id) !== value) changed[id] = value
		}

		const changedIds = Object.keys(changed)
		if (changedIds.length > 0) this.setVariableValues(changed)
		return changedIds
	}
}

runEntrypoint(HotShotCartInstance, [])
