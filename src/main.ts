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
	type CartStatus,
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
import {
	LiveFeed,
	PairError,
	applyCartFields,
	pairWithHost,
	summarizeMirrorCart,
	type CloseInfo,
	type MirrorCart,
	type MirrorSession,
	type ServerMessage,
	type SessionPatch,
} from './ws.js'

const DEFAULT_POLL_INTERVAL_MS = 1000

/** How the module introduces itself to HotShot Cart when pairing and in the WebSocket `hello`. */
const DEVICE_NAME = 'Companion'

type LiveTokenKind = 'control' | 'device'

export class HotShotCartInstance extends InstanceBase<ModuleConfig> {
	public config!: ModuleConfig
	/** Latest known status for each flat button number, from polling or the live feed. */
	public buttonStatus: Record<number, CartSummary> = {}
	/** Latest chain state; idle when the app is older than 0.1.11. */
	public flow: FlowState = { running: false }
	/** Set once the app answers 404 for /api/flow, so old versions are not polled for it. */
	private flowUnsupported = false

	/** Number of buttons variables are currently registered for (Pages x Buttons Per Page). */
	private buttonCount = 0

	private pollTimer?: NodeJS.Timeout
	private pollInFlight = false

	// --- Live feed (HotShot Cart 0.2.0+) ---------------------------------------------------
	private liveFeed?: LiveFeed
	/** True while the WebSocket is open; polling is paused meanwhile. */
	private liveOpen = false
	/** The desk's editable session as mirrored over the feed: carts by page, then by position. */
	private mirrorPages?: MirrorCart[][]
	/** The last `playback` message: the same object `GET /api/status` returns. */
	private livePlayback: StatusResponse = {}
	/** Which token the current/last WebSocket attempt used, so a 401 can be attributed. */
	private liveTokenKind?: LiveTokenKind
	/** Set once the Control API Token was refused, so reconnects go straight to the device token. */
	private preferDeviceToken = false
	/** Last live-feed issue reported at info/warn, so a repeating failure is logged once. */
	private lastLiveIssue?: string

	async init(config: ModuleConfig): Promise<void> {
		this.config = config

		this.setActionDefinitions(GetActions(this))
		this.setFeedbackDefinitions(GetFeedbacks(this))
		this.setPresetDefinitions(GetPresets())
		this.applyVariableLayout()
		this.applyConnectionConfig()
	}

	async destroy(): Promise<void> {
		this.stopLiveFeed()
		this.stopPolling()
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config
		this.preferDeviceToken = false
		this.applyVariableLayout()
		this.applyConnectionConfig()
	}

	private get buttonsPerPage(): number {
		return this.config.buttonsPerPage || DEFAULT_BUTTONS_PER_PAGE
	}

	private get baseUrl(): string {
		return `http://${this.config.host}:${this.config.port}`
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
		// The live feed's data is still valid; lay it out again on the new button numbering
		if (this.liveOpen) this.applyLiveState()
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	/**
	 * Decide how status reaches the module. The live feed is preferred when enabled; polling
	 * runs until the socket is open and again whenever it closes, so an older HotShot Cart
	 * (no /api/ws) or a disabled Remote behaves exactly as before.
	 */
	private applyConnectionConfig(): void {
		this.stopLiveFeed()
		if (this.config.useWebSocket) this.startLiveFeed()
		this.applyPollingConfig()
	}

	private applyPollingConfig(): void {
		if (this.liveOpen) return
		if (this.config.enablePolling) {
			this.updateStatus(InstanceStatus.Connecting)
			this.startPolling()
		} else {
			this.stopPolling()
			// Without polling there is nothing to verify the connection against, unless the feed is trying
			if (this.liveFeed) this.updateStatus(InstanceStatus.Connecting, 'Waiting for the live feed')
			else this.updateStatus(InstanceStatus.Ok)
		}
	}

	async sendCommand(
		path: string,
		method: 'GET' | 'POST' = 'GET',
		body?: Record<string, unknown>,
		options: { quiet404?: boolean } = {}
	): Promise<unknown> {
		const url = `${this.baseUrl}${path}`

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

	// ---------------------------------------------------------------------------------------
	// Polling (every HotShot Cart version)
	// ---------------------------------------------------------------------------------------

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
			// The feed may have opened while this request was in flight; it owns the variables now
			if (this.liveOpen) return

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
		if (this.liveOpen) return
		this.applyFlow(flow)
	}

	// ---------------------------------------------------------------------------------------
	// Live feed (HotShot Cart 0.2.0+)
	// ---------------------------------------------------------------------------------------

	private startLiveFeed(): void {
		const feed = new LiveFeed(`ws://${this.config.host}:${this.config.port}/api/ws`, DEVICE_NAME, {
			getToken: async (_attempt, lastClose) => this.liveFeedToken(lastClose),
			onOpen: () => this.onLiveOpen(),
			onClose: (info) => this.onLiveClose(info),
			onMessage: (msg) => this.onLiveMessage(msg),
			log: (level, message) => this.log(level, message),
		})
		this.liveFeed = feed
		feed.start()
	}

	private stopLiveFeed(): void {
		this.liveFeed?.stop()
		this.liveFeed = undefined
		this.liveOpen = false
		this.liveTokenKind = undefined
		this.lastLiveIssue = undefined
		this.mirrorPages = undefined
		this.livePlayback = {}
	}

	/**
	 * Pick the credential for the next WebSocket attempt: the Control API Token when set (the
	 * desk accepts it while "Require API Token" is on), else the stored device token, else pair
	 * with the code the user typed. Returns undefined to retry later, throws to give up until
	 * the configuration changes.
	 */
	private async liveFeedToken(lastClose?: CloseInfo): Promise<string | undefined> {
		const control = this.config.controlApiToken?.trim() || ''
		let device = this.config.deviceToken?.trim() || ''
		const code = this.config.pairingCode?.trim() || ''

		if (lastClose?.httpStatus === 401) {
			if (this.liveTokenKind === 'control') {
				// The desk only takes the API token while it requires tokens; fall back to pairing
				this.preferDeviceToken = true
				if (!device && !code) {
					this.logLiveIssue(
						'warn',
						'HotShot Cart refused the Control API Token for the live feed (it is only accepted while "Require API Token" is on). Enter a pairing code to use the live feed; polling meanwhile'
					)
				}
			} else if (this.liveTokenKind === 'device' && device) {
				this.logLiveIssue(
					'warn',
					'HotShot Cart no longer accepts the stored device token; enter the pairing code again'
				)
				device = ''
				this.storeConfig({ deviceToken: '' })
			}
		}

		if (control && !this.preferDeviceToken) {
			this.liveTokenKind = 'control'
			return control
		}
		if (device) {
			this.liveTokenKind = 'device'
			return device
		}
		if (code) {
			const token = await this.pair(code)
			if (token) {
				this.liveTokenKind = 'device'
				return token
			}
			// A wrong code was cleared; anything else is worth another try after the backoff
			return this.config.pairingCode?.trim() ? undefined : this.giveUpLiveFeed()
		}
		if (control) {
			// Nothing else to try; keep offering the API token in case "Require API Token" gets turned on
			this.liveTokenKind = 'control'
			return control
		}
		this.logLiveIssue(
			'info',
			'Live feed needs a Control API Token or a pairing code from HotShot Cart (Settings > Control > Remote); polling instead'
		)
		return this.giveUpLiveFeed()
	}

	/** Exchange the pairing code for a device token, storing the token and clearing the code. */
	private async pair(code: string): Promise<string | undefined> {
		try {
			const result = await pairWithHost(this.baseUrl, code, DEVICE_NAME, REQUEST_TIMEOUT_MS)
			this.log('info', `Paired with ${result.hostName || this.config.host} (HotShot Cart ${result.version || '?'})`)
			this.lastLiveIssue = undefined
			this.storeConfig({ deviceToken: result.token, pairingCode: '' })
			return result.token
		} catch (err) {
			if (err instanceof PairError && err.kind === 'wrongCode') {
				this.log('error', 'Pairing failed: wrong pairing code. Check the code in HotShot Cart and enter it again')
				this.storeConfig({ pairingCode: '' })
				return undefined
			}
			const message = err instanceof Error ? err.message : String(err)
			this.logLiveIssue('warn', `Pairing with HotShot Cart failed: ${message}. Polling meanwhile; will retry`)
			return undefined
		}
	}

	/** Stop trying until the configuration changes; polling (if enabled) carries on as before. */
	private giveUpLiveFeed(): never {
		this.liveFeed = undefined
		if (!this.config.enablePolling && !this.liveOpen) this.updateStatus(InstanceStatus.Ok)
		throw new Error('no credential for the live feed')
	}

	/** Update part of the stored configuration without restarting the connection. */
	private storeConfig(changes: Partial<ModuleConfig>): void {
		this.config = { ...this.config, ...changes }
		this.saveConfig(this.config)
	}

	/** Log a live-feed problem once; the same message again goes to debug. */
	private logLiveIssue(level: 'warn' | 'info', message: string): void {
		if (this.lastLiveIssue === message) {
			this.log('debug', message)
			return
		}
		this.lastLiveIssue = message
		this.log(level, message)
	}

	private onLiveOpen(): void {
		this.liveOpen = true
		this.lastLiveIssue = undefined
		this.stopPolling()
		this.updateStatus(InstanceStatus.Ok)
		this.log('info', 'Live feed connected to HotShot Cart; status polling paused')
	}

	private onLiveClose(info: CloseInfo): void {
		const wasOpen = this.liveOpen
		this.liveOpen = false
		this.mirrorPages = undefined
		this.livePlayback = {}

		if (info.httpStatus === 404) {
			this.logLiveIssue(
				'info',
				'HotShot Cart has no live feed (needs 0.2.0 or later with Remote turned on); polling instead'
			)
		} else if (info.httpStatus === 401) {
			// Attributed and reported when the next token is chosen
			this.log('debug', `Live feed refused: ${info.reason}`)
		} else if (wasOpen) {
			this.log('info', `Live feed closed (${info.reason}); polling until it returns`)
		} else {
			this.logLiveIssue('info', `Live feed unavailable (${info.reason}); polling instead`)
		}

		if (this.config.enablePolling) {
			this.startPolling()
		} else {
			this.updateStatus(InstanceStatus.Connecting, 'Live feed reconnecting')
		}
	}

	private onLiveMessage(msg: ServerMessage): void {
		switch (msg.type) {
			case 'session':
				this.applySession(msg.session)
				this.log(
					'debug',
					`Session from ${msg.host?.name ?? this.config.host} (HotShot Cart ${msg.host?.version ?? '?'}), revision ${msg.revision}`
				)
				this.applyLiveState()
				break
			case 'patch':
				this.applyPatch(msg.patch)
				this.applyLiveState()
				break
			case 'playback':
				if (msg.carts && typeof msg.carts === 'object') {
					this.livePlayback = msg.carts
					this.applyLiveState()
				}
				break
			case 'flow':
				if (msg.flow && typeof msg.flow === 'object') this.applyFlow(msg.flow)
				break
			case 'error':
				this.log('warn', `HotShot Cart: ${msg.message}`)
				break
			default:
				// levels, presence, ok: not used by the module
				break
		}
	}

	private applySession(session: MirrorSession): void {
		this.mirrorPages = Array.isArray(session.pages)
			? session.pages.map((page) => (Array.isArray(page) ? page : []))
			: []
		this.checkGridSize(session.config)
	}

	/** Mirror the desk's `applyPatch`: only the listed carts change, new ones appear in place. */
	private applyPatch(patch: SessionPatch): void {
		const pages = this.mirrorPages ?? []
		for (const cp of patch.carts ?? []) {
			if (!cp || typeof cp.page !== 'number' || typeof cp.index !== 'number') continue
			while (pages.length <= cp.page) pages.push([])
			const row = pages[cp.page]
			const existing = row[cp.index]
			row[cp.index] = applyCartFields(existing ?? { id: cp.id }, cp.fields ?? {})
		}
		if (patch.removed?.length) {
			const removed = new Set(patch.removed)
			for (let p = 0; p < pages.length; p++) {
				pages[p] = pages[p].filter((cart) => !removed.has(cart.id))
			}
		}
		this.mirrorPages = pages
		if (patch.config) this.checkGridSize(patch.config)
	}

	/** Warn when the desk's grid does not match Buttons Per Page: button numbers would be off. */
	private checkGridSize(config: MirrorSession['config']): void {
		const rows = config?.gridRows
		const cols = config?.gridCols
		if (typeof rows !== 'number' || typeof cols !== 'number') return
		const perPage = rows * cols
		if (perPage > 0 && perPage !== this.buttonsPerPage) {
			this.log(
				'warn',
				`HotShot Cart grid is ${rows} x ${cols} = ${perPage} buttons per page but the module is set to ${this.buttonsPerPage}; set Buttons Per Page to ${perPage}`
			)
		}
	}

	/**
	 * Combine the mirrored session with the last playback message into the `/api/status`
	 * shape and hand it to the same code polling uses, so every variable comes out identical.
	 * Playback entries (the engine's view) carry state and timing; the session supplies the
	 * editable text for every cart, including ones the engine is not reporting.
	 */
	private applyLiveState(): void {
		if (!this.liveOpen) return
		const merged: StatusResponse = {}
		for (const [id, entry] of Object.entries(this.livePlayback)) {
			if (entry && typeof entry === 'object') merged[id] = { ...entry }
		}

		const pages = this.mirrorPages ?? []
		for (let page = 0; page < pages.length; page++) {
			const row = pages[page]
			for (let index = 0; index < row.length; index++) {
				const cart = row[index]
				if (!cart || typeof cart !== 'object') continue
				// The desk addresses this position as page * buttonsPerPage + index + 1, i.e. this id
				const id = `page-${page}-cart-${index + 1}`
				const meta = summarizeMirrorCart(cart)
				const entry: CartStatus | undefined = merged[id]
				if (entry) {
					// Editable text is authoritative from the session: a patch arrives the moment it is typed
					entry.label = meta.label
					entry.artist = meta.artist
					entry.itemNumber = meta.itemNumber
				} else {
					merged[id] = {
						state: 'idle',
						label: meta.label,
						artist: meta.artist,
						itemNumber: meta.itemNumber,
						trackCount: meta.trackCount,
						duration: meta.duration,
						elapsed: 0,
						timeRemaining: 0,
					}
				}
			}
		}

		this.applyStatus(merged)
	}

	// ---------------------------------------------------------------------------------------
	// Shared state -> variables and feedbacks
	// ---------------------------------------------------------------------------------------

	private applyFlow(flow: FlowState): void {
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
