import { openStreamDeck } from '@elgato-stream-deck/node'
import { createCanvas, registerFont, loadImage } from 'canvas'
import pDebounce from 'p-debounce';
import { fav, next, prev, plaupause } from './icons.mjs';
import LRUCache from 'lru-cache'

const artCache = new LRUCache({
	max: 10,
	fetchMethod: async (key, oldValue, { signal }) => {
const thumbnailCanvas = createCanvas(100, 100)
const thumbnailCtx = thumbnailCanvas.getContext('2d')

		console.log('fetching art')
		const jpegImage = await loadImage(key).catch();
		if(!jpegImage) return;
		thumbnailCtx.drawImage(jpegImage,0,0,100,100);
		console.log('drawn')
		const imageDate = thumbnailCtx.getImageData(0,0,100,100) 
		console.log('got')
		return imageDate;
	},
});

function truncate(str, n) {
	return (str.length > n) ? str.slice(0, n - 1) + '…' : str;
}

const graphics = {
	buttons: Array.from({ length: 8 }, () => {
		const canvas = createCanvas(120, 120)
		return { canvas, ctx: canvas.getContext('2d') }
	}),
	lcd: (() => {
		const canvas = createCanvas(800, 100)
		return { canvas, ctx: canvas.getContext('2d') }
	})()
}

async function drawButton(streamDeck, index, icon, fillColor, backgroundColor) {
	const { canvas, ctx } = graphics.buttons[index];
	console.time('button')
	ctx.fillStyle = backgroundColor;
	ctx.fillRect(0, 0, 120, 120);
	ctx.font = 'Book 90px JetBrainsMono Nerd Font Mono'
	ctx.textAlign = "center";
	ctx.textBaseline = 'middle';
	ctx.fillStyle = fillColor;
	ctx.fillText(icon, 55, 55)
	const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
	console.timeEnd('button')

	const reports = streamDeck.device.generateFillImageWrites(index, buffer)
	await streamDeck.device.device.sendReports(reports)
}

async function render(streamDeck) {
	const { sonosState, lastVolumeChangeTime } = state;
	if (!sonosState) return;
	const { elapsedTime, volume } = sonosState;
	const { duration, absoluteAlbumArtUri } = sonosState.currentTrack;
	const { canvas, ctx } = graphics.lcd;
	console.time('lcd')
	ctx.clearRect(0, 0, 800, 100);
	ctx.font = 'Book 20px JetBrainsMono Nerd Font Mono'
	ctx.fillStyle = "white";
	ctx.strokeStyle = "white";
	ctx.textBaseline = 'top';
	ctx.fillText(truncate(sonosState.currentTrack.artist, 24), 104, 0);
	ctx.fillText(truncate(sonosState.currentTrack.title, 24), 104, 20);
	ctx.strokeRect(104, 46, 296, 16)
	ctx.fillRect(104, 46, Math.floor(296 * elapsedTime / duration), 16)
	ctx.fillText(`${Math.floor(duration / 60)}:${duration % 60}`, 104, 60);
	if (artCache.has(absoluteAlbumArtUri)) {
		// ctx.drawImage(artCache.get(absoluteAlbumArtUri), 0, 0, 100, 100)
		console.log(await artCache.get(absoluteAlbumArtUri))
		ctx.putImageData(await artCache.get(absoluteAlbumArtUri),0,0);
	}

	if (lastVolumeChangeTime > Date.now() - 2000) {
		ctx.clearRect(36, 36, 728, 28);
		ctx.strokeRect(40, 40, 720, 20)
		ctx.fillRect(40, 40, Math.floor(720 * volume / 100), 20)
	}
	const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
	console.timeEnd('lcd')

	const reports = streamDeck.device.generateFillLcdWrites(0, 0, buffer, { width: 800, height: 100 })
	if (sonosState.playbackState === 'PLAYING') {
		drawButton(streamDeck, 1, buttonsIcon[1], "green", "black")
	} else {
		drawButton(streamDeck, 1, buttonsIcon[1], "white", "black")
	}

	await streamDeck.device.device.sendReports(reports)
}

registerFont('font.ttf', { family: 'JetBrainsMono Nerd Font Mono', weight: 'Book' })
const streamDeck = openStreamDeck()


//streamDeck.clearPanel()
const state = {
	sonosState: undefined,
	lastVolumeChangeTime: 0,
}

async function getSonosState() {
	const response = await fetch("http://127.0.0.1:5005/JF%27s%20Office/state");
	const responseJson = await response.json();
	state.sonosState = responseJson;

	artCache.fetch(responseJson.currentTrack.absoluteAlbumArtUri);
	drawLcdFromSonosDebounced();
}

const drawLcdFromSonosDebounced = pDebounce(render.bind(null, streamDeck), 20, { before: false });
const getSonosStateDebounced = pDebounce(getSonosState, 20, { before: false });

getSonosStateDebounced();
setInterval(getSonosStateDebounced, 1000);

const buttonsIcon = [prev, plaupause, next, fav, 1, 2, 3, 4]
const downFct = [
	async () => {
		await fetch("http://127.0.0.1:5005/JF%27s%20Office/previous");
		getSonosState();
	},
	async () => {
		await fetch("http://127.0.0.1:5005/JF%27s%20Office/playpause");
		getSonosState();
	},
	async () => {
		await fetch("http://127.0.0.1:5005/JF%27s%20Office/next");
		getSonosState();
	},
]
const encoderFct = [
	async (amount) => {
		console.log('hrer',)
		await fetch(`http://127.0.0.1:5005/JF%27s%20Office/volume/${amount > 0 ? '+' : ''}${amount * 2}`);
		state.lastVolumeChangeTime = Date.now();
		getSonosState();
	},
]

buttonsIcon.map((icon, idx) => {
	drawButton(streamDeck, idx, icon, "white", "black")
});


// streamDeck.fillKeyBuffer(0, drawButton(0, fav, "black", "white"), {format: 'bgra'}); 

streamDeck.on('down', async (keyIndex) => {
	drawButton(streamDeck, keyIndex, buttonsIcon[keyIndex], "black", "white")
	await downFct[keyIndex]?.();
	// streamDeck.fillKeyBuffer(keyIndex, drawButton(keyIndex, keyIndex, "black", "white"), {format: 'bgra'}); 
	console.log('Filling button #%d', keyIndex)
})

streamDeck.on('up', async (keyIndex) => {
	drawButton(streamDeck, keyIndex, buttonsIcon[keyIndex], "white", "black")
	// streamDeck.fillKeyBuffer(keyIndex, drawButton(keyIndex, keyIndex, "white", "black"), {format: 'bgra'}); 
	console.log('Clearing button #%d', keyIndex)
})

streamDeck.on('encoderDown', (index) => {
	console.log('Encoder down #%d', index)
})
streamDeck.on('encoderUp', (index) => {
	console.log('Encoder up #%d', index)
})

streamDeck.on('rotateLeft', (index, amount) => {
	encoderFct[index]?.(-amount)
	console.log('Encoder left #%d (%d)', index, amount)
})
streamDeck.on('rotateRight', (index, amount) => {
	encoderFct[index]?.(+amount)
	console.log('Encoder right #%d (%d)', index, amount)
})


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
