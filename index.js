const path = require('path')
const { openStreamDeck, DeviceModelId } = require('@elgato-stream-deck/node')

function drawLcd(){

}

;(async () => {
	const streamDeck = openStreamDeck()
	streamDeck.clearPanel()

	if (streamDeck.MODEL !== DeviceModelId.PLUS) throw new Error('Unsupported device')

	console.log('connected');


	streamDeck.on('down', (keyIndex) => {
		// Fill the pressed key with an image of the GitHub logo.
		console.log('Filling button #%d', keyIndex)
		// streamDeck.fillKeyBuffer(keyIndex, img).catch((e) => console.error('Fill failed:', e))
	})

	streamDeck.on('up', (keyIndex) => {
		// Clear the key when it is released.
		console.log('Clearing button #%d', keyIndex)
		streamDeck.clearKey(keyIndex).catch((e) => console.error('Clear failed:', e))
	})

	streamDeck.on('encoderDown', (index) => {
		console.log('Encoder down #%d', index)
	})
	streamDeck.on('encoderUp', (index) => {
		console.log('Encoder up #%d', index)
	})
	streamDeck.on('rotateLeft', (index, amount) => {
		console.log('Encoder left #%d (%d)', index, amount)
	})
	streamDeck.on('rotateRight', (index, amount) => {
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
})()