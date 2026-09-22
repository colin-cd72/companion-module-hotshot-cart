/**
 * Live status feed from HotShot Cart 0.2.0+: the `/api/ws` WebSocket the app's remotes use.
 *
 * The desk publishes its editable session (labels, files, page names) as a `session` snapshot
 * followed by `patch` diffs, playback state as `playback` messages (the same object
 * `GET /api/status` returns, sent whenever it changes) and the running chain as `flow`.
 * The module only listens; commands still go over HTTP so nothing changes for actions.
 *
 * Reconnects with backoff (1 s doubling to 10 s). Whoever owns the feed decides what to do
 * while it is closed; in this module that is the existing status polling.
 */
import WebSocket, { type RawData } from 'ws'
import type { FlowState, StatusResponse } from './api.js'

/** Sent in `hello`; the desk records it next to the device name. */
export const MODULE_VERSION = '1.4.0'

const MIN_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 10000
/** A ping is sent this often while open; the desk answers with a pong. */
const HEARTBEAT_INTERVAL_MS = 15000
/** Without any frame for this long the socket is presumed dead and torn down. */
const HEARTBEAT_TIMEOUT_MS = 40000

// ---------------------------------------------------------------------------------------
// Wire protocol (subset of audio-cart-player/src/remote/protocol.ts)
// ---------------------------------------------------------------------------------------

/** A cart as the desk mirrors it: the editable fields only, no playback state. */
export interface MirrorCart {
	id: string
	label?: string
	artist?: string
	itemNumber?: string
	fileName?: string
	filePath?: string
	duration?: number
	startOffset?: number
	files?: Array<{ id?: string; fileName?: string; duration?: number; startOffset?: number }>
	[key: string]: unknown
}

export interface MirrorSession {
	pages: MirrorCart[][]
	pageNames?: string[]
	config?: { gridRows?: number; gridCols?: number; [key: string]: unknown }
}

export interface CartPatch {
	id: string
	page: number
	index: number
	/** Only the fields that changed; a field set to null was removed */
	fields: Record<string, unknown>
}

export interface SessionPatch {
	revision: number
	carts?: CartPatch[]
	removed?: string[]
	pageNames?: string[]
	config?: MirrorSession['config']
}

export interface HostInfo {
	name: string
	version: string
}

export type ServerMessage =
	| { type: 'session'; revision: number; session: MirrorSession; host: HostInfo }
	| { type: 'patch'; patch: SessionPatch }
	| { type: 'playback'; carts: StatusResponse }
	| { type: 'levels'; levels: number[]; cartLevels?: Record<string, number> }
	| { type: 'flow'; flow: FlowState }
	| { type: 'presence'; operators: unknown[] }
	| { type: 'ok'; requestId: string }
	| { type: 'error'; requestId?: string; message: string }

export interface HelloMessage {
	type: 'hello'
	deviceName: string
	version: string
	lastRevision?: number
}

// ---------------------------------------------------------------------------------------
// Pairing (POST /api/remote/pair)
// ---------------------------------------------------------------------------------------

export interface PairResult {
	token: string
	hostName: string
	version: string
}

export type PairFailure = 'unreachable' | 'wrongCode' | 'locked' | 'remoteOff' | 'other'

export class PairError extends Error {
	constructor(
		public readonly kind: PairFailure,
		message: string
	) {
		super(message)
	}
}

/** Exchange the pairing code shown in HotShot Cart for a device token. */
export async function pairWithHost(
	baseUrl: string,
	code: string,
	deviceName: string,
	timeoutMs: number
): Promise<PairResult> {
	let response: Response
	try {
		response = await fetch(`${baseUrl}/api/remote/pair`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ code: code.trim().toUpperCase(), deviceName }),
			signal: AbortSignal.timeout(timeoutMs),
		})
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)
		throw new PairError('unreachable', `Could not reach ${baseUrl}: ${message}`)
	}
	if (response.status === 403) throw new PairError('wrongCode', 'Wrong pairing code')
	if (response.status === 429) {
		throw new PairError('locked', 'Too many wrong codes; HotShot Cart is refusing pairing for thirty seconds')
	}
	if (response.status === 404) {
		throw new PairError(
			'remoteOff',
			'Remote is off in HotShot Cart (Settings > Control > Remote), or this HotShot Cart is older than 0.2.0'
		)
	}
	if (!response.ok) throw new PairError('other', `HotShot Cart answered HTTP ${response.status} to the pairing request`)

	const result = (await response.json().catch(() => undefined)) as Partial<PairResult> | undefined
	if (!result || typeof result.token !== 'string' || !result.token) {
		throw new PairError('other', 'HotShot Cart did not return a device token')
	}
	return { token: result.token, hostName: result.hostName ?? '', version: result.version ?? '' }
}

// ---------------------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------------------

/** Why the last connection attempt ended, so the owner can log it once and pick a fallback. */
export interface CloseInfo {
	/** HTTP status when the upgrade itself was refused (401 bad token, 404 no /api/ws), else undefined */
	httpStatus?: number
	reason: string
}

export interface LiveFeedHandlers {
	/**
	 * Called before each attempt. Return the token to connect with, or undefined to skip this
	 * attempt (the feed backs off and asks again). Throw to stop the feed for good.
	 */
	getToken: (attempt: number, lastClose?: CloseInfo) => Promise<string | undefined>
	onOpen: () => void
	onClose: (info: CloseInfo) => void
	onMessage: (msg: ServerMessage) => void
	log: (level: 'error' | 'warn' | 'info' | 'debug', message: string) => void
}

export class LiveFeed {
	private socket?: WebSocket
	private stopped = false
	private backoffMs = MIN_BACKOFF_MS
	private retryTimer?: NodeJS.Timeout
	private heartbeatTimer?: NodeJS.Timeout
	private lastFrameAt = 0
	private lastClose?: CloseInfo
	private attempt = 0
	private connecting = false
	/** Reason recorded from the error event, reported by the close that follows it */
	private pendingError?: CloseInfo

	constructor(
		private readonly wsUrl: string,
		private readonly deviceName: string,
		private readonly handlers: LiveFeedHandlers
	) {}

	get isOpen(): boolean {
		return this.socket?.readyState === WebSocket.OPEN
	}

	start(): void {
		this.stopped = false
		void this.connect()
	}

	stop(): void {
		this.stopped = true
		this.clearTimers()
		const socket = this.socket
		this.socket = undefined
		if (socket) {
			socket.removeAllListeners()
			// Terminate rather than close: no handshake to wait on, and no close event to handle
			socket.terminate()
		}
	}

	private async connect(): Promise<void> {
		if (this.stopped || this.connecting || this.socket) return
		this.connecting = true
		this.attempt++

		let token: string | undefined
		try {
			token = await this.handlers.getToken(this.attempt, this.lastClose)
		} catch (err) {
			this.connecting = false
			this.handlers.log('debug', `Live feed stopped: ${err instanceof Error ? err.message : String(err)}`)
			this.stopped = true
			return
		}
		this.connecting = false
		if (this.stopped) return
		if (!token) {
			this.scheduleRetry()
			return
		}

		const url = `${this.wsUrl}?token=${encodeURIComponent(token)}`
		const socket = new WebSocket(url, { handshakeTimeout: 5000 })
		this.socket = socket
		this.pendingError = undefined

		socket.on('open', () => {
			if (this.socket !== socket) return
			this.backoffMs = MIN_BACKOFF_MS
			this.lastClose = undefined
			this.lastFrameAt = Date.now()
			const hello: HelloMessage = { type: 'hello', deviceName: this.deviceName, version: MODULE_VERSION }
			socket.send(JSON.stringify(hello))
			this.startHeartbeat()
			this.handlers.onOpen()
		})

		socket.on('message', (data) => {
			if (this.socket !== socket) return
			this.lastFrameAt = Date.now()
			let msg: ServerMessage
			try {
				msg = JSON.parse(rawDataToString(data)) as ServerMessage
			} catch {
				this.handlers.log('debug', 'Live feed: ignoring a frame that is not JSON')
				return
			}
			if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return
			this.handlers.onMessage(msg)
		})

		socket.on('pong', () => {
			if (this.socket === socket) this.lastFrameAt = Date.now()
		})

		socket.on('error', (err) => {
			if (this.socket !== socket) return
			// `ws` reports a refused upgrade as "Unexpected server response: 404"; the close event follows
			const match = err.message.match(/Unexpected server response: (\d+)/)
			this.pendingError = {
				httpStatus: match ? parseInt(match[1], 10) : undefined,
				reason: err.message,
			}
		})

		socket.on('close', (code, reasonBuffer) => {
			if (this.socket !== socket) return
			this.socket = undefined
			this.clearHeartbeat()
			const reason = reasonBuffer.toString()
			const info: CloseInfo = this.pendingError ?? { reason: reason || `WebSocket closed (code ${code})` }
			this.pendingError = undefined
			this.lastClose = info
			this.handlers.onClose(info)
			this.scheduleRetry()
		})
	}

	private scheduleRetry(): void {
		if (this.stopped || this.retryTimer) return
		const delay = this.backoffMs
		this.backoffMs = Math.min(MAX_BACKOFF_MS, this.backoffMs * 2)
		this.retryTimer = setTimeout(() => {
			this.retryTimer = undefined
			void this.connect()
		}, delay)
	}

	private startHeartbeat(): void {
		this.clearHeartbeat()
		this.heartbeatTimer = setInterval(() => {
			const socket = this.socket
			if (!socket || socket.readyState !== WebSocket.OPEN) return
			if (Date.now() - this.lastFrameAt > HEARTBEAT_TIMEOUT_MS) {
				this.handlers.log('debug', 'Live feed: no frames from HotShot Cart, dropping the connection')
				// terminate() emits close, which resumes polling and schedules the reconnect
				socket.terminate()
				return
			}
			socket.ping()
		}, HEARTBEAT_INTERVAL_MS)
	}

	private clearHeartbeat(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer)
			this.heartbeatTimer = undefined
		}
	}

	private clearTimers(): void {
		this.clearHeartbeat()
		if (this.retryTimer) {
			clearTimeout(this.retryTimer)
			this.retryTimer = undefined
		}
	}
}

// ---------------------------------------------------------------------------------------
// Session mirror -> the fields the module shows
// ---------------------------------------------------------------------------------------

/** The editable fields of one mirrored cart, in the shape `GET /api/status` reports them. */
export interface SessionCartMeta {
	id: string
	label: string
	artist: string
	itemNumber: string
	trackCount: number
	duration: number
}

/**
 * Derive the status-shaped metadata from a mirrored cart. Follows the same rules as the
 * app's `/api/status`: the label falls back to the file name, and duration is the first
 * file's playable length (duration minus start offset), or the legacy single file's.
 */
export function summarizeMirrorCart(cart: MirrorCart): SessionCartMeta {
	const files = Array.isArray(cart.files) ? cart.files : []
	const first = files[0]
	const fileName = strOf(cart.fileName) || strOf(first?.fileName)
	const rawDuration = first
		? numOf(first.duration) - numOf(first.startOffset)
		: numOf(cart.duration) - numOf(cart.startOffset)

	return {
		id: cart.id,
		label: strOf(cart.label) || fileName,
		artist: strOf(cart.artist),
		itemNumber: strOf(cart.itemNumber),
		trackCount: files.length > 0 ? files.length : cart.filePath || cart.fileName ? 1 : 0,
		duration: rawDuration > 0 ? rawDuration : 0,
	}
}

/** Apply one patch entry's fields to a mirrored cart (a null field means removed). */
export function applyCartFields(cart: MirrorCart, fields: Record<string, unknown>): MirrorCart {
	const next: MirrorCart = { ...cart }
	for (const [key, value] of Object.entries(fields)) {
		if (value === null) delete next[key]
		else next[key] = value
	}
	return next
}

/** `ws` hands frames over as Buffer, Buffer[] or ArrayBuffer depending on options; the desk sends text. */
function rawDataToString(data: RawData): string {
	if (typeof data === 'string') return data
	if (Buffer.isBuffer(data)) return data.toString('utf8')
	if (Array.isArray(data)) return Buffer.concat(data).toString('utf8')
	return Buffer.from(data).toString('utf8')
}

function strOf(value: unknown): string {
	return typeof value === 'string' ? value : ''
}

function numOf(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
