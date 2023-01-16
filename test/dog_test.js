'use strict';

const lcd = require('../index.js');
const font = require('font');
const font_fixed_16px = new font.Font();
font_fixed_16px.loadFontFromJSON('font_fixed_16px.json');
font_fixed_16px.spacing = 0;
const font_fixed_8px = new font.Font();
font_fixed_8px.loadFontFromJSON('font_fixed_8px.json');
font_fixed_8px.spacing = 0;
const font_prop_8px = new font.Font();
font_prop_8px.loadFontFromJSON('font_proportional_8px.json');
font_prop_8px.spacing = 0;

let context = {};
context.logger = require('js-logger');
context.logger.useDefaults();
const dogs102 = new lcd.LCD;
const start = Date.now();

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const CB = ([255,255,255,255,255,255,255,255,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,255,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,255,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,255,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0])
const ICB = ([0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,255,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,255,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,255,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,255,255,255,255,255,255])
const img = [0,0,0,0,0,0,0,0,0,0,128,192,192,224,96,112,48,56,24,24,24,24,24,24,24,24,24,24,24,24,24,56,48,112,96,224,192,192,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,192,224,240,240,248,120,120,60,60,60,60,60,60,60,60,120,120,248,240,240,224,192,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,224,240,120,28,14,7,3,1,0,224,224,224,224,224,0,0,0,0,0,0,0,0,0,0,0,0,0,224,224,224,224,224,0,1,3,7,14,28,120,240,224,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,248,254,31,7,3,3,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,3,7,31,254,248,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,252,255,7,0,0,0,0,0,0,0,0,1,1,1,1,1,0,128,192,192,192,192,192,192,192,192,192,192,128,1,1,1,1,1,0,0,0,0,0,0,0,0,7,255,252,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,240,248,28,14,6,126,252,192,0,0,0,0,0,0,0,0,192,252,126,6,14,28,248,240,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,127,255,192,0,0,0,0,0,0,0,0,0,0,0,0,0,0,15,31,29,24,24,24,24,24,24,29,31,15,0,0,0,0,0,0,0,0,0,0,0,0,0,192,255,127,0,0,0,0,0,0,0,0,0,0,0,0,0,15,15,15,63,120,224,192,192,207,255,248,0,0,0,0,0,0,248,255,207,192,192,224,120,63,15,15,15,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,15,30,60,112,224,192,128,0,0,0,0,0,0,240,248,156,140,140,140,140,140,140,156,248,240,0,0,0,0,0,0,0,0,0,128,192,224,112,60,30,15,3,0,0,0,0,0,0,0,0,0,0,0,0,0,12,28,28,28,28,252,252,204,13,13,1,0,0,0,0,0,0,0,0,1,25,25,248,248,216,24,24,184,240,224,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,7,6,14,12,28,24,56,48,48,48,48,48,48,48,48,48,48,48,48,48,56,24,28,12,14,6,7,3,1,0,0,0,0,0,0,0,0,0,128,192,224,112,48,56,56,24,24,24,184,240,240,248,254,207,15,127,255,195,3,3,131,131,131,131,131,195,227,115,251,255,255,127,255,252,217,27,25,56,56,48,112,224,224,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,3,0,0,0,56,124,252,252,254,247,247,180,182,183,255,255,254,255,207,198,246,39,143,255,127,3,1,120,255,255,1,0,0,0,7,31,62,48,0,0,0,0,0,3,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,7,15,30,28,56,48,48,48,48,48,48,56,56,28,15,7,3,1,13,15,15,15,3,1,1,0,0,0,0,3,7,15,28,24,56,48,48,48,48,48,48,56,28,30,15,7,1,0,0,0,0,0,0];
const img30p = ([0,0,0,0,0,0,0,0,0,0,128,192,192,224,96,112,48,56,24,24,24,24,24,24,24,24,24,24,24,24,24,56,48,112,96,224,192,192,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,192,224,240,240,248,120,120,60,60,60,60,60,60,60,60,120,120,248,240,240,224,192,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,224,240,120,28,14,7,3,1,0,224,224,224,224,224,0,0,0,0,0,0,0,0,0,0,0,0,0,224,224,224,224,224,0,1,3,7,14,28,120,240,224,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,248,254,31,7,3,3,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,3,7,31,254,248,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,252,255,7,0,0,0,0,0,0,0,0,1,1,1,1,1,0,128,192,192,192,192,192,192,192,192,192,192,128,1,1,1,1,1,0,0,0,0,0,0,0,0,7,255,252,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,240,248,28,14,6,126,252,192,0,0,0,0,0,0,0,0,192,252,126,6,14,28,248,240,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,127,255,192,0,0,0,0,0,0,0,0,0,0,0,0,0,0,15,31,29,24,24,24,24,24,24,29,31,15,0,0,0,0,0,0,0,0,0,0,0,0,0,192,255,127,0,0,0,0,0,0,0,0,0,0,0,0,0,15,15,15,63,120,224,192,192,207,255,248,0,0,0,0,0,0,248,255,207,192,192,224,120,63,15,15,15,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,15,30,60,112,224,192,128,0,0,0,0,0,0,240,248,156,140,140,140,140,140,140,156,248,240,0,0,0,0,0,0,0,0,0,128,192,224,112,60,30,15,3,0,0,0,0,0,0,0,0,0,0,0,0,0,12,28,28,28,28,252,252,204,13,13,1,0,0,0,0,0,0,0,0,1,25,25,248,248,216,24,24,184,240,224,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,7,6,14,12,28,24,56,48,48,48,48,48,48,48,48,48,48,48,48,48,56,24,28,12,14,6,7,3,1,0,0,0,0,0,0,0,0,0,128,192,224,112,48,56,56,24,24,24,184,240,240,248,254,207,15,127,255,195,3,3,131,131,131,131,131,195,227,115,251,255,255,127,255,252,217,27,25,56,56,48,112,224,224,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,3,0,0,0,56,124,252,252,254,247,247,180,182,183,255,255,254,255,207,198,246,39,143,255,127,3,1,120,255,255,1,0,0,0,7,31,62,48,0,0,0,0,0,3,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,7,15,30,28,56,48,48,48,48,48,48,56,56,28,15,7,3,1,13,15,15,15,3,1,1,0,0,0,0,3,7,15,28,24,56,48,48,48,48,48,48,56,28,30,15,7,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);

function fullScreenMessage(text,waitFor) {
    dogs102.clear();
    dogs102.moveToColPage(0,2);
    return dogs102.writeText(text,font_prop_8px,0);
    // .then(_ => delay(waitFor))
    // .then(_ => dogs102.clear())
    // .then(_ => resolve())
    // .catch(e => reject(e))        
}

function contrastLoop (start, end) {
    return new Promise(async (resolve) => {
        end +=1;
        for (let i = start; i < end ; i++) {
            await (dogs102.Contrast = i);
            await dogs102.moveToColPage(5,4);
            await dogs102.writeText("Contrast: " + i,font_fixed_8px,0);
            await delay(200);
        }
        resolve();
    })
}

context.logger.info('Starting demo');
dogs102.openInterface({pinCd: 25, pinRst: 20, speedHz: 20000})
.then(_=> dogs102.hwResetOn())
.then(_ => dogs102.initialize({viewDirection: 0, volume: 10,line:0, inverted: false}))
//.then(_ => fullScreenMessage('Display images',1500))
// .then(_ => dogs102.moveToColPage(0,0))
// // .then(_ => dogs102.transfer(1,new Uint8Array(dogs102._width).map(_=> Math.random()*255)))
// .then(_ => dogs102.drawImageP(img,8,102,0))
// .then(_ => delay(2000))
// .then(_ => fullScreenMessage('Change contrast',1500))
// .then(_ => contrastLoop(0,20))
// .then(_ => dogs102.Contrast = 10)
// .then(_ => fullScreenMessage("Different fonts ",1000))
// .then(_ => dogs102.moveToColPage(0,1))
// .then(_ => dogs102.writeText("16px fixed",font_fixed_16px,0))
// .then(_ => dogs102.moveToColPage(0,4))
// .then(_ => dogs102.writeText("8px fixed",font_fixed_8px,0))
// .then(_ => dogs102.moveToColPage(0,6))
// .then(_ => dogs102.writeText("8px prop",font_prop_8px,0))
// .then(_ => dogs102.initialize({speedHz: 800000, viewDirection: 1, volume: 20,line:0}))
// .then(_ => dogs102.transfer(0,dogs102.cmdAdvProgCtrl(false,true,true)))
// .then(_ => dogs102.moveToColPage(0,0))
// .then(_ => dogs102.transfer(1,new Uint8Array(dogs102._width).map(_=> Math.random()*255)))
// .then(_ => dogs102.transfer(1, img30p))

//.then(_ => dogs102.moveToColPage(3,3))
//.then(_ => dogs102.transfer(0,dogs102.cmdAdvProgCtrl(true, true, true)))
// .then(_ => dogs102.moveBy(2,-50))
// .then(_ => dogs102.writeText("EADOG102", font_fixed_16px))
// .then(_=>console.log(dogs102.cmdAdvProgCtrl(true, true, true)))
// .then(_=>console.log('Chain ended:', Date.now() -start))
.then(_ => dogs102.closeInterface())
.then(_ => dogs102.hwResetOn())
.catch((error) => {console.log('Error: ' + error)})
.finally(_ => console.log('Bye Bye!'))
