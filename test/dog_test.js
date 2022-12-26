'use strict';

const font = require('font');
const lcd = require('../index.js');
const { setIntervalAsync } = require('set-interval-async/dynamic');
const { clearIntervalAsync } = require('set-interval-async');

var handle;

const viewDirection = lcd.viewDirection;
const font_fixed_8px = new font.Font();
font_fixed_8px.loadFontFromJSON('font_fixed_8px.json')
const font_fixed_16px = new font.Font();
font_fixed_16px.loadFontFromJSON('font_fixed_16px.json')
font_fixed_16px.spacing = 0;
const font_prop_8px = new font.Font();
font_prop_8px.loadFontFromJSON('font_proportional_8px.json')
const font_prop_16px = new font.Font();
font_prop_16px.loadFontFromJSON('font_proportional_16px.json')
font_prop_16px.spacing = 0;
const font_digits_24 = new font.Font();
font_digits_24.loadFontFromJSON('digits_24px.json')
const font_digits_32 = new font.Font();
font_digits_32.loadFontFromJSON('digits_32px.json')
font_digits_32.spacing=0;
const symbols_8px = new font.Font();
symbols_8px.loadFontFromJSON('symbols_8px.json')
const symbols_16px = new font.Font();
symbols_16px.loadFontFromJSON('symbols_16px.json')

const dogs102 = new lcd.DogS102();
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
dogs102.initialize({pinCd: 9, pinRst: 7, speedHz: 800000, viewDirection: 0, volume: 6, pinBacklight: 25})
// .then(_ => {
//     console.log("HW reset");
//     dogs102.hwReset(10)
// })
.then(_ => dogs102.clear())
.then(_=> dogs102.backlightOn())
.then(_ => {
    console.log('next write');  
    handle = dogs102.step("Nick Cave and the Bad Seeds - Murder Ballads +++ ",font_prop_16px, 1, 1, 1200);
    // setTimeout(async () => {
    //     await clearIntervalAsync(handle);
    //     console.log("--- ENDE ---")
    // }, 25000);
})
// .then(_=> writeArray(["eins","zwei","drei","vier"],0))
// .then(_=> writeArray(["zwei","drei","vier","fünf"],0))
// .then(_=> writeArray(["drei","vier","fünf","sechs"],0))
// .then(_=> writeArray(["vier","fünf","sechs","sieben"],0))
// .then(_=> writeArray(["fünf","sechs","sieben","acht"],0))
// .then(_=> writeArray(["eins","zwei","drei","acht"],0))

//.then(_ => dogs102.moveToColPage(3,3))
//.then(_ => dogs102.transfer(0,dogs102.cmdAdvProgCtrl(true, true, true)))
// .then(_ => dogs102.moveBy(-2,50))
// .then(_ => dogs102.writeText("nodejs is cool",font_fixed_16px))
// .then(_ => dogs102.moveBy(2,-50))
// .then(_ => dogs102.writeText("EADOG102", font_fixed_16px))
// .then(_=>console.log(dogs102.cmdAdvProgCtrl(true, true, true)))
// .then(_=>console.log('Chain ended:', Date.now() -start))
.catch((error) => {throw error});
