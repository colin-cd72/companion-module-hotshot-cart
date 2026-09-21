/**
 * Types and helpers for the HotShot Cart HTTP API.
 */

/** Default cart buttons per page in HotShot Cart (4 x 6 grid). Cart IDs look like `page-0-cart-1`. */
export const DEFAULT_BUTTONS_PER_PAGE = 24

/** Default number of pages in HotShot Cart. */
export const DEFAULT_PAGES = 10

/** Milliseconds before an HTTP request to HotShot Cart is abandoned. */
export const REQUEST_TIMEOUT_MS = 5000

export interface CartTrackStatus {
	fileName: string
	state: string
	duration: number
	elapsed: number
	progress: number
	timeRemaining: number
	channels: number
	fileId: string
}

/** One entry of the `GET /api/status` response, keyed by cart ID. */
export interface CartStatus {
	state?: string
	fileName?: string
	label?: string
	artist?: string
	itemNumber?: string
	trackCount?: number
	channels?: number
	duration?: number
	elapsed?: number
	progress?: number
	timeRemaining?: number
	fileTracks?: CartTrackStatus[]
}

export type StatusResponse = Record<string, CartStatus>

/** A cart status flattened into the fields the module actually uses. */
export interface CartSummary {
	id: string
	state: string
	label: string
	artist: string
	itemNumber: string
	trackCount: number
	duration: number
	elapsed: number
	timeRemaining: number
}

const CART_ID_PATTERN = /page-(\d+)-cart-(\d+)$/

/**
 * Map a cart ID such as `page-1-cart-3` to the flat button number HotShot Cart's
 * `/api/button/:n` routes use (with 24 per page: page 0 = 1-24, page 1 = 25-48, ...).
 * Returns undefined for IDs in an unknown format.
 */
export function cartIdToButtonNumber(cartId: string, buttonsPerPage = DEFAULT_BUTTONS_PER_PAGE): number | undefined {
	const match = CART_ID_PATTERN.exec(cartId)
	if (!match) return undefined
	return parseInt(match[1], 10) * buttonsPerPage + parseInt(match[2], 10)
}

/** Fill gaps in a cart's top-level fields from its first file track. */
export function summarizeCart(id: string, data: CartStatus): CartSummary {
	const track = data.fileTracks?.[0]
	const state = data.state && data.state !== 'idle' ? data.state : (track?.state ?? 'idle')
	const fileName = data.fileName || track?.fileName || ''

	return {
		id,
		state,
		label: data.label || fileName,
		artist: data.artist ?? '',
		itemNumber: data.itemNumber ?? '',
		trackCount: data.trackCount ?? 0,
		duration: data.duration || track?.duration || 0,
		elapsed: data.elapsed || track?.elapsed || 0,
		timeRemaining: data.timeRemaining || track?.timeRemaining || 0,
	}
}

export function pad2(value: number): string {
	return String(value).padStart(2, '0')
}

export interface TimecodeParts {
	hh: string
	mm: string
	ss: string
	ff: string
}

/** Split seconds into zero-padded hours, minutes, seconds and hundredths. */
export function splitTimecode(seconds: number): TimecodeParts {
	const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
	return {
		hh: pad2(Math.floor(safe / 3600)),
		mm: pad2(Math.floor((safe % 3600) / 60)),
		ss: pad2(Math.floor(safe % 60)),
		ff: pad2(Math.floor((safe % 1) * 100)),
	}
}

/** Format seconds as `HH:MM:SS.FF`. */
export function formatTimecode(seconds: number): string {
	const { hh, mm, ss, ff } = splitTimecode(seconds)
	return `${hh}:${mm}:${ss}.${ff}`
}

/** Format seconds as `M:SS`, or an empty string when there is no time. */
export function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds <= 0) return ''
	const mins = Math.floor(seconds / 60)
	const secs = Math.floor(seconds % 60)
	return `${mins}:${pad2(secs)}`
}

/** `GET /api/flow`: the running chain, as reported by HotShot Cart 0.1.11+. */
export interface FlowState {
	running: boolean
	currentCartId?: string | null
	currentLabel?: string | null
	nextCartId?: string | null
	nextLabel?: string | null
	goLabel?: string | null
	paused?: boolean
}
