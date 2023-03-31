import {openStreamDeck, DeviceModelId } from '@elgato-stream-deck/node'
import { createCanvas, registerFont }  from 'canvas'
import pDebounce from 'p-debounce';
import {fav, next} from './icons.mjs';

registerFont('font.ttf', { family: 'JetBrainsMono Nerd Font Mono',  weight: 'Book'})

const graphics = {
	buttons: Array.from({length: 8}, () => {
		const canvas = createCanvas(120, 120)
		return {canvas, ctx:canvas.getContext('2d')}
	}),
	lcd: (() =>{
		const canvas = createCanvas(800, 100)
		return {canvas, ctx:canvas.getContext('2d')}
	})()
}


function drawButton(index, icon, fillColor, backgroundColor){
	const {canvas, ctx } = graphics.buttons[index];
	console.time('button')
	ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, 120, 120);
	ctx.font = 'Book 90px JetBrainsMono Nerd Font Mono'
	ctx.textAlign = "center";
	ctx.textBaseline = 'middle';
	ctx.fillStyle = fillColor;
	ctx.fillText(icon, 55, 55)
	const buffer = canvas.toBuffer('raw');
	console.timeEnd('button')
  return buffer;
}

function drawLcd(len = 100){
	const {canvas, ctx } = graphics.lcd;
	console.time('lcd')
	ctx.clearRect(0, 0, 800,100);
	ctx.fillStyle = "white";
  ctx.fillRect(10, 10, len, 80);
	ctx.font = 'Book 40px JetBrainsMono Nerd Font Mono'
	ctx.fillStyle = "red";
	ctx.fillText('Everyone', 100, 40);
	const buffer = canvas.toBuffer('raw');
	console.timeEnd('lcd')
  return buffer;
}


let state =100;


const streamDeck = openStreamDeck()
const fillLcd= pDebounce(streamDeck.fillLcdRegion.bind(streamDeck), 20,{before: false});

streamDeck.clearPanel()
console.log(streamDeck)

if (streamDeck.MODEL !== DeviceModelId.PLUS) throw new Error('Unsupported device')

console.log('connected');


streamDeck.fillKeyBuffer(0, drawButton(0, fav, "black", "white"), {format: 'bgra'}); 
streamDeck.fillLcdRegion(0, 0, drawLcd(), { width: 800, height: 100, stride: 800 * 4, offset: 0, format: 'bgra', })


streamDeck.on('down', (keyIndex) => {
  streamDeck.fillKeyBuffer(keyIndex, drawButton(keyIndex, keyIndex, "black", "white"), {format: 'bgra'}); 
	console.log('Filling button #%d', keyIndex)
})

streamDeck.on('up', (keyIndex) => {
  streamDeck.fillKeyBuffer(keyIndex, drawButton(keyIndex, keyIndex, "white", "black"), {format: 'bgra'}); 
	console.log('Clearing button #%d', keyIndex)
})

streamDeck.on('encoderDown', (index) => {
	console.log('Encoder down #%d', index)
})
streamDeck.on('encoderUp', (index) => {
	console.log('Encoder up #%d', index)
})


streamDeck.on('rotateLeft', (index, amount) => {
	state -= amount;
	fillLcd(0, 0, drawLcd(state), { width: 800, height: 100, stride: 800 * 4, offset: 0, format: 'bgra', })
	console.log('Encoder left #%d (%d)', index, amount)
})
streamDeck.on('rotateRight', (index, amount) => {
	state += amount;
	fillLcd(0, 0, drawLcd(state), { width: 800, height: 100, stride: 800 * 4, offset: 0, format: 'bgra', })
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