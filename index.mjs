import { openStreamDeck, listStreamDecks } from '@elgato-stream-deck/node'
import { createCanvas, registerFont, loadImage } from 'canvas'
import pDebounce from 'p-debounce';
import { fav, next, prev, plaupause, shuffle, wifi, wifi_reset } from './icons.mjs';
import { LRUCache } from 'lru-cache'
import EventSource from 'eventsource'
import { isAnyIsaacDeviceBlocked, toggleIsaacDevices, reconnectAllDevices } from './unify.mjs'

const es = new EventSource('http://127.0.0.1:5005/events');
es.onerror = console.log


const artCache = new LRUCache({
	max: 10,
	fetchMethod: async (key, oldValue, { signal }) => {
		const thumbnailCanvas = createCanvas(58, 58)
		const thumbnailCtx = thumbnailCanvas.getContext('2d')
		const jpegImage = await loadImage(key).catch();
		if (!jpegImage) return;
		thumbnailCtx.drawImage(jpegImage, 0, 0, 58, 58);
		const imageDate = thumbnailCtx.getImageData(0, 0, 58, 58)
		return imageDate;
	},
});

function truncate(str, n) {
	return (str.length > n) ? str.slice(0, n - 1) + '…' : str;
}

const graphics = {
	buttons: Array.from({ length: 8 }, () => {
		const canvas = createCanvas(96, 96)
		return { canvas, ctx: canvas.getContext('2d', { pixelFormat: 'RGB24' }) }
	}),
	lcd: (() => {
		const canvas = createCanvas(248, 58)
		return { canvas, ctx: canvas.getContext('2d', { pixelFormat: 'RGB24' }) }
	})()
}

async function drawButton(streamDeck, index, icon, fillColor, backgroundColor) {
	const { canvas, ctx } = graphics.buttons[index];
	console.time('button')
	ctx.fillStyle = backgroundColor;
	ctx.fillRect(0, 0, 96, 96);
	ctx.font = 'Book 60px JetBrainsMono Nerd Font Mono'
	ctx.textAlign = "center";
	ctx.textBaseline = 'middle';
	ctx.fillStyle = fillColor;
	ctx.fillText(icon, 48, 48)
	const buffer = canvas.toBuffer('raw');
	console.timeEnd('button')
	await streamDeck.fillKeyBuffer(index, buffer, { format: 'rgba' })
}

async function renderSonos(streamDeck) {
	const { sonosState, lastVolumeChangeTime } = state;
	if (!sonosState) return;
	const { elapsedTime, volume } = sonosState;
	const { duration, absoluteAlbumArtUri } = sonosState.currentTrack;
	const { canvas, ctx } = graphics.lcd;
	console.time('lcd')
	ctx.clearRect(0, 0, 248, 58);
	ctx.font = 'Book 13px JetBrainsMono Nerd Font Mono'
	ctx.fillStyle = "white";
	ctx.strokeStyle = "white";
	ctx.textBaseline = 'top';
	ctx.fillText(truncate(sonosState.currentTrack.artist, 24), 60, 0);
	ctx.fillText(truncate(sonosState.currentTrack.title, 24), 60, 20);
	// ctx.strokeRect(60, 46, 246, 16)
	// ctx.fillRect(60, 46, Math.floor(246 * elapsedTime / duration), 16)
	const durToString = (dur) => `${Math.floor(dur / 60)}:${dur % 60 <= 9 ? '0' : ''}${dur % 60}`;
	ctx.fillText(`${durToString(elapsedTime)} / ${durToString(duration)}`, 60, 40); ctx
	if (artCache.has(absoluteAlbumArtUri)) {
		ctx.putImageData(await artCache.get(absoluteAlbumArtUri), 0, 0);
	}

	if (lastVolumeChangeTime > Date.now() - 2000) {
		ctx.clearRect(10, 23, 228, 20);
		ctx.strokeRect(10, 23, 228, 20)
		ctx.fillRect(10, 23, Math.floor(228 * volume / 100), 20)
	}

	const buffer = canvas.toBuffer('raw');
	console.timeEnd('lcd')
	await streamDeck.fillLcd(0, buffer, { format: 'rgba' })
}

registerFont('font.ttf', { family: 'JetBrainsMono Nerd Font Mono', weight: 'Book' })

const devices = await listStreamDecks()
if (devices.length === 0) throw new Error('No streamdecks connected!')
const streamDeck = await openStreamDeck(devices[0].path)


const state = {
	sonosState: undefined,
	lastVolumeChangeTime: 0,
	isaacBlocked: undefined
}

async function getSonosState() {
	const response = await fetch("http://127.0.0.1:5005/JF%27s%20Office/state");
	const responseJson = await response.json();
	reactToSonosStateChange(state.sonosState, responseJson)
	state.sonosState = responseJson;

	artCache.fetch(responseJson.currentTrack.absoluteAlbumArtUri);
	drawLcdFromSonosDebounced();
}

const drawLcdFromSonosDebounced = pDebounce(renderSonos.bind(null, streamDeck), 20, { before: false });
const getSonosStateDebounced = pDebounce(getSonosState, 20, { before: false });

getSonosStateDebounced();
setInterval(getSonosStateDebounced, 500);

const reactToSonosStateChange = (prevState, curState) => {
	if (prevState?.playbackState !== curState?.playbackState) {
		if (curState.playbackState === 'PLAYING') {
			drawButton(streamDeck, 1, buttonsIcon[1], "green", "black")
		} else {
			drawButton(streamDeck, 1, buttonsIcon[1], "white", "black")
		}
	}
	if (prevState?.playMode?.shuffle !== curState?.playMode?.shuffle) {
		if (curState?.playMode?.shuffle) {
			drawButton(streamDeck, 3, buttonsIcon[3], "green", "black")
		} else {
			drawButton(streamDeck, 3, buttonsIcon[3], "white", "black")
		}
	}
}

es.onmessage = (e) => {
	const msg = JSON.parse(e.data);
	const { type, data } = msg;
	if (data.roomName !== "JF's Office") return;
	console.log(`event: ${type}`)
	if (type === 'volume-change') {
		state.sonosState.volume = data.newVolume;
		drawLcdFromSonosDebounced(streamDeck)
	} else if (type === 'transport-state') {
		reactToSonosStateChange(state.sonosState, data.state)
		state.sonosState = data.state;
		drawLcdFromSonosDebounced(streamDeck)
	} else {
		console.warn(`unknown event type: ${type}`);
	}

}

const buttonsIcon = [prev, plaupause, next, shuffle, 1, 2, wifi_reset, wifi]
const downFct = [
	async () => await fetch("http://127.0.0.1:5005/JF%27s%20Office/previous"),
	async () => await fetch("http://127.0.0.1:5005/JF%27s%20Office/playpause"),
	async () => await fetch("http://127.0.0.1:5005/JF%27s%20Office/next"),
	async () => await fetch("http://127.0.0.1:5005/jf%27s%20office/shuffle/toggle"),
	async () => await fetch("http://127.0.0.1:5005/JF%27s%20Office/playlist/work"),
	undefined,
	reconnectAllDevices,
	async () => { await toggleIsaacDevices(); await checkBlockState() },
	async () => {
		await fetch(`http://127.0.0.1:5005/JF%27s%20Office/volume/-5`);
		state.lastVolumeChangeTime = Date.now();
	},
	async () => { 
		await fetch(`http://127.0.0.1:5005/JF%27s%20Office/volume/+5`);
		state.lastVolumeChangeTime = Date.now();
	 }
]

const checkBlockState = async () => {
	const isIsaacBlocked = await isAnyIsaacDeviceBlocked();
	if (isIsaacBlocked !== state.isaacBlocked && isIsaacBlocked) {
		drawButton(streamDeck, 7, wifi, "red", "black")
	} else if (isIsaacBlocked !== state.isaacBlocked && !isIsaacBlocked) {
		drawButton(streamDeck, 7, wifi, "white", "black")
	}
	state.isaacBlocked = isIsaacBlocked;
}

const encoderFct = [
	async (amount) => {
		await fetch(`http://127.0.0.1:5005/JF%27s%20Office/volume/${amount > 0 ? '+' : ''}${amount * 2}`);
		state.lastVolumeChangeTime = Date.now();
	},
]

buttonsIcon.map((icon, idx) => {
	drawButton(streamDeck, idx, icon, "white", "black")
});

streamDeck.on('down', async (event) => {
	console.log(event)
	const keyIndex = event.index;
	if (keyIndex < 8) {
		drawButton(streamDeck, keyIndex, buttonsIcon[keyIndex], "black", "white")
	}
	await downFct[keyIndex]?.();
})

streamDeck.on('up', async (event) => {
	console.log(event)
	const keyIndex = event.index;
	if (keyIndex < 8) {
		drawButton(streamDeck, keyIndex, buttonsIcon[keyIndex], "white", "black")
	}
})

// streamDeck.on('encoderDown', (index) => {
// 	console.log('Encoder down #%d', index)
// })
// streamDeck.on('encoderUp', (index) => {
// 	console.log('Encoder up #%d', index)
// })

// streamDeck.on('rotateLeft', (index, amount) => {
// 	encoderFct[index]?.(-amount)
// })
// streamDeck.on('rotateRight', (index, amount) => {
// 	encoderFct[index]?.(+amount)
// })


streamDeck.on('lcdShortPress', (index, pos) => {
	console.log('lcd short press #%d (%d, %d)', index, pos.x, pos.y)
})
streamDeck.on('lcdLongPress', (index, pos) => {
	console.log('lcd long press #%d (%d, %d)', index, pos.x, pos.y)
})
streamDeck.on('lcdSwipe', (index, index2, pos, pos2) => {
	console.log('lcd swipe #%d->#%d (%d, %d)->(%d, %d)', index, index2, pos.x, pos.y, pos2.x, pos2.y)
})

streamDeck.on('error', (error) => {
	console.error(error)
})
