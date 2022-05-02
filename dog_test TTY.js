'use strict';

const font = require('../Font');
const lcd = require('./index');
// const { setIntervalAsync } = require('set-interval-async/dynamic');
// const { clearIntervalAsync } = require('set-interval-async');

var handle;

const viewDirection = lcd.viewDirection;
const font_fixed_8px = new font.Font();
font_fixed_8px.loadFontFromJSON('./LCD/Fonts_JSON/font_fixed_8px.json')
const font_fixed_16px = new font.Font();
font_fixed_16px.loadFontFromJSON('./LCD/Fonts_JSON/font_fixed_16px.json')
font_fixed_16px.spacing = 0;
const font_prop_8px = new font.Font();
font_prop_8px.loadFontFromJSON('./LCD/Fonts_JSON/font_proportional_8px.json')
const font_prop_16px = new font.Font();
font_prop_16px.loadFontFromJSON('./LCD/Fonts_JSON/font_proportional_16px.json')
font_prop_16px.spacing = 0;
const font_digits_24 = new font.Font();
font_digits_24.loadFontFromJSON('./LCD/Fonts_JSON/digits_24px.json')
const font_digits_32 = new font.Font();
font_digits_32.loadFontFromJSON('./LCD/Fonts_JSON/digits_32px.json')
font_digits_32.spacing=0;
const symbols_8px = new font.Font();
symbols_8px.loadFontFromJSON('./LCD/Fonts_JSON/symbols_8px.json')
const symbols_16px = new font.Font();
symbols_16px.loadFontFromJSON('./LCD/Fonts_JSON/symbols_16px.json')

const dogs102 = new lcd.TTYSimulator();
const start = Date.now();

function writeArray(arr, line){
    return new Promise((resolve, reject) => {
        let txt = arr.shift();
        dogs102.moveToColPage(1,line)
        .then(_ => dogs102.writeLine(txt,font_prop_16px))
        .then(_ => {
            console.log (txt)
            if (arr.length > 0) {
                writeArray(arr,(line + 2)%8)
                .then(_ => resolve())
            } else {
                setTimeout(() => {
                    console.log ("----")
                    resolve();
                    return;                    
                }, 200);
            }
        })
    })
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let handleTimer
console.log('Start Chain', Date.now() -start)
let d = new Date();
dogs102.initialize({pinCd: 25, pinRst: 20, speedHz: 800000, viewDirection: 0, volume: 6})
.then(_ => dogs102.clear())
// .then(_ => {
//     handle = dogs102.step("Nick Cave and the Bad Seeds - Murder Ballads +++ ",font_prop_16px, 1, 1, 1200);
//     // setTimeout(async () => {
//     //     await clearIntervalAsync(handle);
//     //     console.log("--- ENDE ---")
//     // }, 25000);
// })
// .then(_=> writeArray(["eins","zwei","drei","vier"],0))
// .then(_=> writeArray(["zwei","drei","vier","fünf"],0))
// .then(_=> writeArray(["drei","vier","fünf","sechs"],0))
// .then(_=> writeArray(["vier","fünf","sechs","sieben"],0))
// .then(_=> writeArray(["fünf","sechs","sieben","acht"],0))
// .then(_=> writeArray(["eins","zwei","drei","acht"],0))

.then(_ => dogs102.moveToColPage(0,0))
//.then(_ => dogs102.transfer(0,dogs102.cmdAdvProgCtrl(true, true, true)))
// .then(_ => dogs102.moveBy(-2,50))
// .then(_ => dogs102.writeText("LCD Simulator",font_fixed_16px))
.then(_ => dogs102.setPageBufferLines(0,"Deutschlandfunk Nachrichten",font_prop_16px,lcd.fontStyle.underlined,lcd.animationTypes.swingPage))
.then(_ => dogs102.setPageBufferLines(2,"Deutschlandfunk Kultur",font_prop_16px,lcd.fontStyle.strikethrough + lcd.fontStyle.inverted,lcd.animationTypes.swingPage))
.then(_ => dogs102.setPageBufferLines(4,"Deutschlandfunk Nova",font_prop_16px,lcd.fontStyle.doubleStrikethrough + lcd.fontStyle.doubleUnderline,lcd.animationTypes.swingPage))
.then(_ => dogs102.setPageBufferLines(6,"Back",font_prop_16px,0,lcd.animationTypes.swingPage))
.then(_ => dogs102.startAnimation(1000))
// .then(_ => setTimeout(() => {
//     dogs102.setPageBufferLines(4,"text geändert - mal schauen",font_prop_16px,0,lcd.animationTypes.swingPage)
// }, 5000))
// .then(_=> dogs102.step("19.12.22  16:45",font_prop_8px,0,0,1500))
// .then(_=> dogs102.step("Radio Hamburg",font_prop_8px,0,1,1500))
// .then(_=> dogs102.step("Pink Floyd - Wish you were here",font_prop_8px,0,2,1500))
// .then(_=> dogs102.step("Play               ",font_prop_8px,0,3,1500))
// .then(_ => dogs102.moveBy(2,-50))
// .then(_ => dogs102.writeText("EADOG102", font_fixed_16px))
// .then(_=>console.log(dogs102.cmdAdvProgCtrl(true, true, true)))
// .then(_=>console.log('Chain ended:', Date.now() -start))
.catch((error) => {throw error});
