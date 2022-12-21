'use strict';

const lcd = require('../index.js');

var handle;

const dogs102 = new lcd.DogS102();
const start = Date.now();

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

console.log('Start Chain', Date.now() -start)
let d = new Date();
dogs102.initialize({pinCd: 25, pinRst: 20, speedHz: 800000, viewDirection: 0, volume: 6})
.then(_ => dogs102.clear())
.then(_ => dogs102.transfer(1,new Uint8Array(dogs102._width).map(_=> Math.random()*255)))
.then(_ => dogs102.moveToColPage(4,1))
.then(_ => dogs102.transfer(1,[0xFF,0xFF,0xFF,0x00,0x00,0x0F,0x0F,0x0F,0x0F,0xF0,0xF0,0xF0,0xF0]))
.then(_ => dogs102.moveToColPage(8,2))
.then(_ => dogs102.transfer(1,[0xFF,0xFF,0xFF,0x00,0x00,0x0F,0x0F,0x0F,0x0F,0xF0,0xF0,0xF0,0xF0]))
.then(_ => dogs102.moveToColPage(12,3))
.then(_ => dogs102.transfer(1,[0xFF,0xFF,0xFF,0x00,0x00,0x0F,0x0F,0x0F,0x0F,0xF0,0xF0,0xF0,0xF0]))
.then(_ => dogs102.moveToColPage(16,4))
.then(_ => dogs102.transfer(1,[0xFF,0xFF,0xFF,0x00,0x00,0x0F,0x0F,0x0F,0x0F,0xF0,0xF0,0xF0,0xF0]))
.then(_ => dogs102.moveToColPage(24,5))
.then(_ => dogs102.transfer(1,[0xFF,0xFF,0xFF,0x00,0x00,0x0F,0x0F,0x0F,0x0F,0xF0,0xF0,0xF0,0xF0]))
.then(_ => dogs102.moveToColPage(28,6))
.then(_ => dogs102.transfer(1,[0xFF,0xFF,0xFF,0x00,0x00,0x0F,0x0F,0x0F,0x0F,0xF0,0xF0,0xF0,0xF0]))
.then(_ => dogs102.moveToColPage(32,7))
.then(_ => dogs102.transfer(1,[0xFF,0xFF,0xFF,0x00,0x00,0x0F,0x0F,0x0F,0x0F,0xF0,0xF0,0xF0,0xF0]))

.then(_ => delay(2000))
// .then(_ => dogs102.hwReset(10))

//.then(_ => dogs102.moveToColPage(3,3))
//.then(_ => dogs102.transfer(0,dogs102.cmdAdvProgCtrl(true, true, true)))
// .then(_ => dogs102.moveBy(-2,50))
// .then(_ => dogs102.writeText("nodejs is cool",font_fixed_16px))
// .then(_ => dogs102.moveBy(2,-50))
// .then(_ => dogs102.writeText("EADOG102", font_fixed_16px))
// .then(_=>console.log(dogs102.cmdAdvProgCtrl(true, true, true)))
// .then(_=>console.log('Chain ended:', Date.now() -start))
.catch((error) => {throw error});
